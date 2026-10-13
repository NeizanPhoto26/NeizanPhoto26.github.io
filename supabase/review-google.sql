-- Ejecutar después de las actualizaciones de fotos y edición.
-- No borra reseñas. Las nuevas se vinculan a la cuenta autenticada.
begin;
alter table public.reviews add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.reviews alter column user_id set default auth.uid();
create index if not exists reviews_user_id on public.reviews(user_id) where user_id is not null;
grant select (id,name,rating,comment,created_at,approved,photos,photo_count) on public.reviews to authenticated;
drop policy if exists "Account read public reviews" on public.reviews;
create policy "Account read public reviews" on public.reviews for select to authenticated using (approved = true);
-- A partir de esta actualización, publicar requiere una cuenta.
revoke execute on function public.submit_review(uuid,text,smallint,text,boolean,text,jsonb) from anon;
grant execute on function public.submit_review(uuid,text,smallint,text,boolean,text,jsonb) to authenticated;
grant execute on function public.review_summary() to authenticated;

create or replace function public.claim_my_review(p_id uuid,p_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed integer;
begin
    if auth.uid() is null or p_token is null or p_token !~ '^[a-f0-9]{64}$' then return false; end if;
    update public.reviews set user_id = auth.uid()
    where id = p_id and user_id is null and delete_token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex');
    get diagnostics claimed = row_count;
    return claimed = 1;
end;
$$;
create or replace function public.my_review_ids()
returns table(id uuid) language sql stable security definer set search_path = '' as $$
    select id from public.reviews where auth.uid() is not null and user_id = auth.uid();
$$;
create or replace function public.delete_own_review(p_id uuid,p_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare deleted integer;
begin
    delete from public.reviews where id = p_id and (
        (auth.uid() is not null and user_id = auth.uid()) or
        (user_id is null and p_token ~ '^[a-f0-9]{64}$' and delete_token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex'))
    );
    get diagnostics deleted = row_count;
    return deleted = 1;
end;
$$;
create or replace function public.update_own_review(p_id uuid,p_token text,p_name text,p_rating smallint,p_comment text,p_consent boolean,p_photos jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare photo jsonb; updated integer;
begin
    if p_photos is null or jsonb_typeof(p_photos) <> 'array' then raise exception 'Invalid photos'; end if;
    if jsonb_array_length(p_photos)>3 then raise exception 'Too many photos'; end if;
    for photo in select value from jsonb_array_elements(p_photos) loop
        if jsonb_typeof(photo)<>'string' or length(photo #>> '{}')>165000 or (photo #>> '{}') !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then raise exception 'Invalid photo'; end if;
    end loop;
    update public.reviews set name=btrim(p_name),rating=p_rating,comment=btrim(p_comment),consent=p_consent,photos=p_photos,photo_count=jsonb_array_length(p_photos)
    where id=p_id and (
        (auth.uid() is not null and user_id=auth.uid()) or
        (user_id is null and p_token ~ '^[a-f0-9]{64}$' and delete_token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex'))
    );
    get diagnostics updated=row_count;
    return updated=1;
end;
$$;
revoke all on function public.claim_my_review(uuid,text) from public;
revoke all on function public.my_review_ids() from public;
revoke all on function public.delete_own_review(uuid,text) from public;
revoke all on function public.update_own_review(uuid,text,text,smallint,text,boolean,jsonb) from public;
grant execute on function public.claim_my_review(uuid,text) to authenticated;
grant execute on function public.my_review_ids() to authenticated;
grant execute on function public.delete_own_review(uuid,text) to anon,authenticated;
grant execute on function public.update_own_review(uuid,text,text,smallint,text,boolean,jsonb) to anon,authenticated;
commit;
