/**
 * POST /api/external/property-post
 * 
 * API nhận tin BĐS từ hệ thống bên ngoài (ZaloCRM).
 * - Xác thực bằng API Key (header x-api-key)
 * - Auto-create user nếu senderUid chưa có trong hệ thống
 * - Tạo intent (CẦN/CÓ) trên feed can-co
 * - Trigger matching + bot comment pipeline
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseSearchIntent, generateIntentTitle, isConfigured as isOpenAIConfigured } from '@/lib/engine/openai'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

interface PropertyPostRequest {
  senderName: string
  senderUid: string
  contactInfo?: string | null
  requestType: 'mua' | 'bán' | 'cho_thuê' | 'thuê' | string
  propertyType?: string | null
  location?: string | null
  area?: string | null
  priceRange?: string | null
  details: string
  source: string // 'zalocrm'
  // Optional: ZaloCRM reference data
  requestId?: string
  conversationId?: string
}

// ═══════════════════════════════════════════════════════
// Auth Middleware
// ═══════════════════════════════════════════════════════

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  const expectedKey = process.env.EXTERNAL_API_KEY
  if (!expectedKey) {
    console.error('[external-api] EXTERNAL_API_KEY not configured')
    return false
  }
  return apiKey === expectedKey
}

// ═══════════════════════════════════════════════════════
// Auto User Registration
// ═══════════════════════════════════════════════════════

async function getOrCreateUser(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  senderUid: string,
  senderName: string,
  contactInfo?: string | null,
  externalSource: string = 'zalocrm'
): Promise<string> {
  // 1. Check if user already exists by external_id
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('external_source', externalSource)
    .eq('external_id', senderUid)
    .single()

  if (existingProfile) {
    return existingProfile.id
  }

  // 2. Create new auth user via admin API
  const email = `zalo_${senderUid}@zalocrm.external`
  const password = `ext_${senderUid}_${Date.now()}_${Math.random().toString(36).slice(2)}`

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: senderName,
      external_source: externalSource,
      external_id: senderUid,
      phone: contactInfo || null,
    },
  })

  if (authError) {
    // Nếu email đã tồn tại (race condition), tìm lại
    if (authError.message?.includes('already')) {
      const { data: retryProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('external_source', externalSource)
        .eq('external_id', senderUid)
        .single()
      if (retryProfile) return retryProfile.id
    }
    throw new Error(`Failed to create auth user: ${authError.message}`)
  }

  const userId = authData.user.id

  // 3. Upsert profile with external mapping
  await supabase.from('profiles').upsert({
    id: userId,
    display_name: senderName,
    external_id: senderUid,
    external_source: externalSource,
    phone: contactInfo || null,
    verification_level: 'none',
    trust_score: 1,
  })

  return userId
}

// ═══════════════════════════════════════════════════════
// Intent Type Mapping
// ═══════════════════════════════════════════════════════

function mapRequestTypeToIntentType(requestType: string): 'CAN' | 'CO' {
  // CẦN = đang tìm mua/thuê (buyer/renter side)
  // CÓ  = đang muốn bán/cho thuê (seller/landlord side)
  switch (requestType?.toLowerCase()) {
    case 'mua':
    case 'thuê':
    case 'cần mua':
    case 'cần thuê':
      return 'CAN'
    case 'bán':
    case 'cho_thuê':
    case 'cho thuê':
    case 'cần bán':
      return 'CO'
    default:
      return 'CAN' // default: đang tìm
  }
}

function mapPropertyType(propertyType: string | null | undefined): string {
  const mapping: Record<string, string> = {
    'nhà': 'house',
    'đất': 'land',
    'căn_hộ': 'apartment',
    'chung_cư': 'apartment',
    'phòng_trọ': 'room',
    'biệt_thự': 'villa',
    'mặt_bằng': 'office',
    'kho_xưởng': 'office',
    'shophouse': 'shophouse',
    'khác': 'other',
  }
  return mapping[propertyType || ''] || 'apartment'
}

// ═══════════════════════════════════════════════════════
// Build Post Content
// ═══════════════════════════════════════════════════════

function buildRawText(data: PropertyPostRequest): string {
  const parts: string[] = []
  
  const actionLabel = data.requestType === 'mua' ? 'Cần mua'
    : data.requestType === 'bán' ? 'Cần bán'
    : data.requestType === 'cho_thuê' ? 'Cho thuê'
    : data.requestType === 'thuê' ? 'Cần thuê'
    : data.requestType

  parts.push(`${actionLabel} ${data.propertyType || 'bất động sản'}`)
  
  if (data.location) parts.push(`tại ${data.location}`)
  if (data.area) parts.push(`diện tích ${data.area}`)
  if (data.priceRange) parts.push(`giá ${data.priceRange}`)
  if (data.details) parts.push(`\n${data.details}`)
  if (data.contactInfo) parts.push(`\nLiên hệ: ${data.contactInfo}`)

  return parts.join(', ')
}

function parsePrice(priceRange: string | null | undefined): number | null {
  if (!priceRange) return null
  // Try to extract number from strings like "3-5 tỷ", "500 triệu", "2.5 tỷ"
  const match = priceRange.match(/([\d.,]+)\s*(tỷ|ty|triệu|trieu|tr)/i)
  if (!match) return null
  const num = parseFloat(match[1].replace(',', '.'))
  const unit = match[2].toLowerCase()
  if (unit === 'tỷ' || unit === 'ty') return num * 1_000_000_000
  if (unit === 'triệu' || unit === 'trieu' || unit === 'tr') return num * 1_000_000
  return null
}

// ═══════════════════════════════════════════════════════
// Main Handler
// ═══════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { error: 'Unauthorized — invalid or missing API key' },
        { status: 401 }
      )
    }

    // 2. Parse body
    const body: PropertyPostRequest = await request.json()
    
    if (!body.senderUid || !body.details) {
      return NextResponse.json(
        { error: 'senderUid and details are required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // 3. Get or create user
    const userId = await getOrCreateUser(
      supabase,
      body.senderUid,
      body.senderName || 'Zalo User',
      body.contactInfo,
      body.source || 'zalocrm'
    )

    // 4. Map intent type
    const intentType = mapRequestTypeToIntentType(body.requestType)
    const subcategory = mapPropertyType(body.propertyType)
    const rawText = buildRawText(body)
    const price = parsePrice(body.priceRange)

    // 5. AI parsing (best-effort, tương tự logic có sẵn)
    let title = rawText.slice(0, 100)
    let district: string | null = null
    let parsedData: Record<string, unknown> = {}

    if (isOpenAIConfigured()) {
      try {
        const [intent, aiTitle] = await Promise.all([
          parseSearchIntent(rawText),
          generateIntentTitle(rawText, intentType),
        ])
        title = aiTitle
        district = intent.districts?.[0] || null
        parsedData = {
          district,
          bedrooms: intent.bedrooms,
          area_min: intent.area_min,
          area_max: intent.area_max,
          keywords: intent.keywords,
          preferences: intent.preferences,
          source_system: body.source,
        }
      } catch {
        // AI failed — use raw data
        parsedData = {
          source_system: body.source,
          original_property_type: body.propertyType,
          original_location: body.location,
        }
      }
    }

    // 6. Extract district from location if AI didn't find it
    if (!district && body.location) {
      // Simple pattern: "Quận X", "Huyện Y", "TP Z"
      const districtMatch = body.location.match(/(?:quận|huyện|tp\.?|thành phố)\s+([^\s,]+)/i)
      if (districtMatch) district = districtMatch[0]
    }

    // 7. Create intent
    const { data: intentData, error: intentError } = await supabase
      .from('intents')
      .insert({
        user_id: userId,
        type: intentType,
        raw_text: rawText,
        title,
        category: 'real_estate',
        subcategory,
        price,
        district,
        address: body.location,
        parsed_data: parsedData,
        source: body.source || 'zalocrm',
        external_ref: {
          system: body.source || 'zalocrm',
          requestId: body.requestId || null,
          conversationId: body.conversationId || null,
          senderUid: body.senderUid,
          originalRequestType: body.requestType,
        },
      })
      .select('id, type, title, created_at')
      .single()

    if (intentError) {
      console.error('[external-api] Insert intent error:', intentError)
      return NextResponse.json(
        { error: `Failed to create intent: ${intentError.message}` },
        { status: 500 }
      )
    }

    console.log(`[external-api] ✅ Created intent ${intentData.id} (${intentType}) from ${body.source} for user ${userId}`)

    // 8. Return success
    return NextResponse.json({
      success: true,
      intentId: intentData.id,
      userId,
      intentType: intentData.type,
      title: intentData.title,
      createdAt: intentData.created_at,
    }, { status: 201 })
  } catch (error) {
    console.error('[external-api] Property post error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET — health check / docs cho API
export async function GET() {
  return NextResponse.json({
    service: 'can-co External Property API',
    version: '1.0.0',
    endpoints: {
      'POST /api/external/property-post': {
        description: 'Nhận tin BĐS từ hệ thống ngoài, auto-create user + intent',
        auth: 'x-api-key header',
        body: {
          senderName: 'string (required)',
          senderUid: 'string (required)',
          contactInfo: 'string | null',
          requestType: 'mua | bán | cho_thuê | thuê',
          propertyType: 'nhà | đất | căn_hộ | ...',
          location: 'string | null',
          area: 'string | null',
          priceRange: 'string | null',
          details: 'string (required)',
          source: 'string (default: zalocrm)',
        },
      },
    },
  })
}
