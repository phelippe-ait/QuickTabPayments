-- =====================================================================
-- QuickTab Admin — Storage buckets and policies
-- ---------------------------------------------------------------------
-- Run AFTER 0004_rls_policies.sql in the Supabase SQL editor.
--
-- Buckets:
--   * restaurant-assets : logos and cover images
--   * menu-items        : menu item photos
--
-- Both are public-read, 5 MB, JPEG/PNG/WebP. Writes are limited to active
-- staff of the restaurant whose id is the first folder segment:
--   restaurant-assets/{restaurant_id}/logo.{ext}
--   restaurant-assets/{restaurant_id}/cover.{ext}
--   menu-items/{restaurant_id}/{menu_item_id}.{ext}
--
-- The migration is safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Buckets
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('restaurant-assets', 'restaurant-assets', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('menu-items',        'menu-items',        true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Helper: restaurant id encoded in the first folder segment
-- ---------------------------------------------------------------------
-- Returns null instead of raising when a caller targets a malformed path, so
-- the policy simply denies the write.
create or replace function public.storage_folder_restaurant_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
declare
  v_segment text;
begin
  v_segment := split_part(p_name, '/', 1);
  begin
    return v_segment::uuid;
  exception when invalid_text_representation then
    return null;
  end;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. storage.objects policies
-- ---------------------------------------------------------------------
drop policy if exists "storage_public_read_project_images" on storage.objects;
create policy "storage_public_read_project_images"
  on storage.objects for select
  using (bucket_id in ('restaurant-assets', 'menu-items'));

drop policy if exists "storage_staff_write_restaurant_assets" on storage.objects;
create policy "storage_staff_write_restaurant_assets"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'restaurant-assets'
    and public.is_staff_of(public.storage_folder_restaurant_id(name))
  )
  with check (
    bucket_id = 'restaurant-assets'
    and public.is_staff_of(public.storage_folder_restaurant_id(name))
  );

drop policy if exists "storage_staff_write_menu_items" on storage.objects;
create policy "storage_staff_write_menu_items"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'menu-items'
    and public.is_staff_of(public.storage_folder_restaurant_id(name))
  )
  with check (
    bucket_id = 'menu-items'
    and public.is_staff_of(public.storage_folder_restaurant_id(name))
  );
