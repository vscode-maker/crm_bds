-- ═══════════════════════════════════════════════════════
-- PHASE 115: EXTERNAL API INTEGRATION
-- Thêm cột external_id cho profiles, source cho intents
-- Hỗ trợ nhận dữ liệu BĐS từ hệ thống bên ngoài (ZaloCRM)
-- ═══════════════════════════════════════════════════════

-- 1. Thêm external_id vào profiles để map user từ hệ thống ngoài
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS external_id VARCHAR(200),
  ADD COLUMN IF NOT EXISTS external_source VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_external
  ON public.profiles(external_source, external_id)
  WHERE external_id IS NOT NULL;

-- 2. Thêm source cho intents để phân biệt nguồn tạo
ALTER TABLE public.intents
  ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS external_ref JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_intents_source ON intents(source);
