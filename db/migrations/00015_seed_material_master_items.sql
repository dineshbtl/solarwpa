-- ═══════════════════════════════════════════════════════════════
-- Migration 00015: Seed full Solar EPC material master items
-- ═══════════════════════════════════════════════════════════════

DELETE FROM public.material_master;

INSERT INTO public.material_master (id, name, per_hh, unit, is_active)
VALUES
  ('MAT-001', 'Solar PV Module', 4, 'Nos', true),
  ('MAT-002', 'Inverter', 1, 'Nos', true),
  ('MAT-003', 'Structure', 1, 'Nos', true),
  ('MAT-004', 'Bolts Set', 1, 'Nos', true),
  ('MAT-005', '4.0 Sqmm DC Cable BLACK', 10, 'Mtr', true),
  ('MAT-006', '4.0 SQMM DC CABLE RED & BLACK', 10, 'Mtr', true),
  ('MAT-007', '16SQMM GREEN WIRE', 25, 'Mtr', true),
  ('MAT-008', 'ACDB BOX& DCDB BOX', 1, 'Nos', true),
  ('MAT-009', 'MC4 CONNECTERS PACK', 1, 'Nos', true),
  ('MAT-010', '45*45 PVC CHANNEL', 1, 'Nos', true),
  ('MAT-011', 'PVC PIPE', 8, 'Nos', true),
  ('MAT-012', '1'' FLEXIBLE PIPE', 1, 'Nos', true),
  ('MAT-013', 'AC CABLE RED', 3, 'Mtr', true),
  ('MAT-014', 'AC CABLE RED &BLACK', 3, 'Mtr', true),
  ('MAT-015', 'EARTHING KIT', 1, 'Nos', true),
  ('MAT-016', 'CONDUIT KIT', 1, 'Nos', true);
