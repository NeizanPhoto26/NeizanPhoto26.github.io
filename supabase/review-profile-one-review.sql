-- Ejecuta este archivo una vez en Supabase > SQL Editor.
-- Añade la foto pública de Google y limita cada cuenta a una reseña.
begin;

alter table public.reviews add column if not exists avatar_url text;

-- Completa la foto de las reseñas que ya están vinculadas a una cuenta.
update public.reviews as review
set avatar_url = coalesce(profile.raw_user_meta_data ->> 'avatar_url', profile.raw_user_meta_data ->> 'picture')
from auth.users as profile
where review.user_id = profile.id
  and review.avatar_url is null
  and coalesce(profile.raw_user_meta_data ->> 'avatar_url', profile.raw_user_meta_data ->> 'picture') ~ '^https://';

-- Las reseñas nuevas (y las editadas) conservan la foto actual de Google.
create or replace function public.set_review_google_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare image_url text;
begin
    if new.user_id is null then new.user_id := auth.uid(); end if;
    if new.user_id is not null then
        select coalesce(raw_user_meta_data ->> 'avatar_url', raw_user_meta_data ->> 'picture')
        into image_url
        from auth.users where id = new.user_id;
        if image_url ~ '^https://' then new.avatar_url := image_url; end if;
    end if;
    return new;
end;
$$;
drop trigger if exists set_review_google_profile on public.reviews;
create trigger set_review_google_profile
before insert or update on public.reviews
for each row execute function public.set_review_google_profile();

-- No se borra nada: si esto avisa de duplicados, revísalos antes de volver a ejecutarlo.
do $$
begin
    if exists (
        select 1 from public.reviews
        where user_id is not null
        group by user_id having count(*) > 1
    ) then
        raise exception 'Hay cuentas con más de una reseña. Revisa esas filas antes de activar el límite.';
    end if;
end;
$$;
create unique index if not exists reviews_one_review_per_account
on public.reviews (user_id) where user_id is not null;

grant select (id,name,rating,comment,created_at,approved,photos,photo_count,avatar_url)
on public.reviews to anon, authenticated;

commit;
