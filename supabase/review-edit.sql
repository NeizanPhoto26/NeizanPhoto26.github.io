-- Ejecutar completo en SQL Editor. Requiere la actualización de fotos ya instalada.
-- Conserva las reseñas y solo permite editar con el código privado del autor.
begin;
create or replace function public.update_own_review(
    p_id uuid, p_token text, p_name text, p_rating smallint,
    p_comment text, p_consent boolean, p_photos jsonb
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
    photo jsonb;
    updated_count integer;
begin
    if p_id is null or p_token is null or p_token !~ '^[a-f0-9]{64}$' then return false; end if;
    if p_photos is null or jsonb_typeof(p_photos) <> 'array' then raise exception 'Invalid photos'; end if;
    if jsonb_array_length(p_photos) > 3 then raise exception 'Too many photos'; end if;
    for photo in select value from jsonb_array_elements(p_photos) loop
        if jsonb_typeof(photo) <> 'string' or length(photo #>> '{}') > 165000
            or (photo #>> '{}') !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then
            raise exception 'Invalid photo';
        end if;
    end loop;
    update public.reviews
    set name = btrim(p_name), rating = p_rating, comment = btrim(p_comment),
        consent = p_consent, photos = p_photos, photo_count = jsonb_array_length(p_photos)
    where id = p_id and delete_token_hash = pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex'
    );
    get diagnostics updated_count = row_count;
    return updated_count = 1;
end;
$$;
revoke all on function public.update_own_review(uuid, text, text, smallint, text, boolean, jsonb) from public;
grant execute on function public.update_own_review(uuid, text, text, smallint, text, boolean, jsonb) to anon;
commit;
