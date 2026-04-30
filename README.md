# Week Menu Maker

A small browser app that lets you:

- add your own recipe names
- save the ingredients for each recipe
- click `Make Week Menu` to randomize recipes across the week
- sync recipes with Supabase so they appear on your phone and laptop

## Run it locally

Open `index.html` in your browser.

## Connect Supabase

This app now supports Supabase in a simple static-site setup using the official browser CDN for `@supabase/supabase-js`:

- Supabase JavaScript install docs: https://supabase.com/docs/reference/javascript/installing
- Supabase database docs: https://supabase.com/docs/guides/database

### 1. Create a Supabase project

In Supabase:

- create a new project
- wait for the project to finish provisioning

### 2. Create the `recipes` table

Open the SQL editor in Supabase and run:

```sql
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ingredients text[] not null default '{}',
  source_url text,
  source_provider text,
  source_caption text,
  created_at timestamptz not null default now()
);

create table if not exists public.week_menu_state (
  singleton_key text primary key,
  recipe_ids text[] not null default '{}',
  included_grocery_recipe_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.grocery_checklist_items (
  item_key text primary key,
  label text not null,
  ingredient_name text not null,
  item_count integer not null default 1,
  checked boolean not null default false,
  source_type text not null default 'generated',
  source_recipe_id text,
  source_recipe_name text,
  updated_at timestamptz not null default now()
);
```

If you already created the tables earlier, run this migration too:

```sql
alter table public.week_menu_state
add column if not exists included_grocery_recipe_ids text[] not null default '{}';

alter table public.recipes
add column if not exists source_url text,
add column if not exists source_provider text,
add column if not exists source_caption text;

alter table public.grocery_checklist_items
add column if not exists source_type text not null default 'generated',
add column if not exists source_recipe_id text,
add column if not exists source_recipe_name text;
```

### 3. Allow the app to read and write recipes

For this first version, the app is set up as a simple no-login website. That means the recipe table needs public access from the site.

Run this in the SQL editor:

```sql
alter table public.recipes enable row level security;

create policy "Public can read recipes"
on public.recipes
for select
to anon
using (true);

create policy "Public can add recipes"
on public.recipes
for insert
to anon
with check (true);

create policy "Public can delete recipes"
on public.recipes
for delete
to anon
using (true);

create policy "Public can update recipes"
on public.recipes
for update
to anon
using (true)
with check (true);

alter table public.week_menu_state enable row level security;

create policy "Public can read week menu state"
on public.week_menu_state
for select
to anon
using (true);

create policy "Public can upsert week menu state"
on public.week_menu_state
for insert
to anon
with check (true);

create policy "Public can update week menu state"
on public.week_menu_state
for update
to anon
using (true)
with check (true);

alter table public.grocery_checklist_items enable row level security;

create policy "Public can read grocery checklist items"
on public.grocery_checklist_items
for select
to anon
using (true);

create policy "Public can add grocery checklist items"
on public.grocery_checklist_items
for insert
to anon
with check (true);

create policy "Public can update grocery checklist items"
on public.grocery_checklist_items
for update
to anon
using (true)
with check (true);

create policy "Public can delete grocery checklist items"
on public.grocery_checklist_items
for delete
to anon
using (true);
```

Important:

- this is fine for a personal prototype
- anyone with your website and browser tools could technically read or change the shared recipes
- if you want private recipes per person, the next step would be Supabase Auth

### 4. Copy your project URL and anon key

In Supabase:

- go to `Project Settings`
- go to `API`
- copy the `Project URL`
- copy the `anon public` key

### 5. Paste them into `supabase-config.js`

Open `supabase-config.js` and replace the placeholders:

```js
window.WEEK_MENU_SUPABASE_CONFIG = {
  supabaseUrl: "YOUR_PROJECT_URL",
  supabaseAnonKey: "YOUR_ANON_KEY",
};
```

Optional: Instagram previews need Meta oEmbed access. The importer still works without this if you paste the caption yourself.

```js
window.WEEK_MENU_SUPABASE_CONFIG = {
  supabaseUrl: "YOUR_PROJECT_URL",
  supabaseAnonKey: "YOUR_ANON_KEY",
  instagramOembedAccessToken: "YOUR_META_OEMBED_ACCESS_TOKEN",
};
```

### 6. Publish your updated files to GitHub Pages

Make sure these files are in your repo:

- `index.html`
- `styles.css`
- `script.js`
- `supabase-config.js`

After you push the changes, GitHub Pages will rebuild the site automatically.

## How it behaves

- if Supabase is configured correctly, recipes are stored online and synced
- Instagram/TikTok imports create a draft from a pasted caption or transcript; TikTok previews may load directly, while Instagram previews need an oEmbed token
- the current generated week menu and grocery checklist can also sync through Supabase
- if Supabase is not configured yet, the app falls back to browser storage so it still works

## Files

- `index.html`: app structure and Supabase CDN script
- `script.js`: recipe logic, random week menu, and Supabase calls
- `styles.css`: app styling
- `supabase-config.js`: your Supabase URL and anon key
