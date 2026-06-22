-- Debug query to check filter data relationships

-- Check business managers
SELECT 
  id as bm_uuid,
  business_manager_id as bm_meta_id,
  name as bm_name
FROM meta_business_managers
ORDER BY name;

-- Check ad accounts and their BM links
SELECT 
  ma.id as account_uuid,
  ma.ad_account_id as account_meta_id,
  ma.name as account_name,
  ma.business_manager_id as linked_bm_uuid,
  mb.name as bm_name,
  mb.business_manager_id as bm_meta_id
FROM meta_ad_accounts ma
LEFT JOIN meta_business_managers mb ON ma.business_manager_id = mb.id
ORDER BY ma.name;

-- Count accounts per BM
SELECT 
  mb.name as bm_name,
  COUNT(ma.id) as account_count
FROM meta_business_managers mb
LEFT JOIN meta_ad_accounts ma ON ma.business_manager_id = mb.id
GROUP BY mb.id, mb.name
ORDER BY mb.name;
