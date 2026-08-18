-- ============================================================================
-- Patio Madera ARAUCO — Schema Supabase (v2 · offline-ready)
--
-- ⚠️ ESTE SCRIPT BORRA Y RECREA LAS TABLAS (para pasar de IDs autoincrementales
-- a UUID generados por el cliente, requisito para que la app funcione sin
-- señal). Si ya tenías datos reales cargados, se perderán — este proyecto
-- todavía está en etapa de pruebas, así que no debería ser un problema. Vuelve
-- a ejecutar TODO el script en: Supabase Dashboard → SQL Editor → New query → Run
--
-- Por qué UUID: cuando el tractorista carga un tractor sin señal, la app
-- necesita asignarle un ID definitivo AHÍ MISMO (para poder seguir operando
-- localmente: despacharlo a línea, descargarlo, etc.) sin esperar a que el
-- servidor confirme. Con IDs autoincrementales eso es imposible porque el
-- número lo entrega la base de datos. Con UUID, el celular genera un ID
-- único globalmente en el momento, y cuando vuelve la señal, ese mismo ID ya
-- es el definitivo — no hay que "renumerar" nada.
-- ============================================================================

create extension if not exists "pgcrypto";

drop table if exists viajes cascade;
drop table if exists tractores cascade;
drop table if exists columnas cascade;
drop table if exists lineas cascade;

-- ---- TABLAS -----------------------------------------------------------------

create table tractores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  patente text not null,
  capacidad numeric not null,
  estado text not null default 'disponible' check (estado in ('disponible', 'en_viaje')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table columnas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo_madera text not null,
  volumen_total numeric not null,
  volumen_disponible numeric not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table lineas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  consumo_acumulado numeric not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table viajes (
  id uuid primary key default gen_random_uuid(),
  folio text unique not null,
  tractor_id uuid references tractores(id) on delete set null,
  tractor_nombre text,
  columna_id uuid references columnas(id) on delete set null,
  columna_nombre text,
  tipo_madera text,
  volumen_carga numeric not null,
  linea_id uuid references lineas(id) on delete set null,
  linea_nombre text,
  volumen_descarga numeric,
  estado text not null default 'cargado' check (estado in ('cargado', 'en_transito', 'completado')),
  fecha_carga date not null default current_date,
  hora_carga timestamptz not null default now(),
  hora_transito timestamptz,
  hora_descarga timestamptz,
  observaciones text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_viajes_estado on viajes(estado);
create index idx_viajes_fecha on viajes(fecha_carga);

-- ---- ROW LEVEL SECURITY -------------------------------------------------------

alter table tractores enable row level security;
alter table columnas enable row level security;
alter table lineas enable row level security;
alter table viajes enable row level security;

create policy "auth read tractores" on tractores for select using (auth.role() = 'authenticated');
create policy "auth write tractores" on tractores for insert with check (auth.role() = 'authenticated');
create policy "auth update tractores" on tractores for update using (auth.role() = 'authenticated');
create policy "auth delete tractores" on tractores for delete using (auth.role() = 'authenticated');

create policy "auth read columnas" on columnas for select using (auth.role() = 'authenticated');
create policy "auth write columnas" on columnas for insert with check (auth.role() = 'authenticated');
create policy "auth update columnas" on columnas for update using (auth.role() = 'authenticated');
create policy "auth delete columnas" on columnas for delete using (auth.role() = 'authenticated');

create policy "auth read lineas" on lineas for select using (auth.role() = 'authenticated');
create policy "auth write lineas" on lineas for insert with check (auth.role() = 'authenticated');
create policy "auth update lineas" on lineas for update using (auth.role() = 'authenticated');

create policy "auth read viajes" on viajes for select using (auth.role() = 'authenticated');
create policy "auth write viajes" on viajes for insert with check (auth.role() = 'authenticated');
create policy "auth update viajes" on viajes for update using (auth.role() = 'authenticated');

-- ---- REALTIME -----------------------------------------------------------------

alter publication supabase_realtime add table tractores;
alter publication supabase_realtime add table columnas;
alter publication supabase_realtime add table lineas;
alter publication supabase_realtime add table viajes;

-- ---- SEED (datos de ejemplo) -----------------------------------------

insert into tractores (nombre, patente, capacidad, estado) values
  ('Tractor 07', 'TR-07', 35, 'disponible'),
  ('Tractor 12', 'TR-12', 40, 'disponible'),
  ('Tractor 03', 'TR-03', 30, 'disponible'),
  ('Tractor 21', 'TR-21', 38, 'disponible');

insert into columnas (nombre, tipo_madera, volumen_total, volumen_disponible) values
  ('COL-01', 'Pino Radiata', 800, 620),
  ('COL-02', 'Eucalipto', 650, 410),
  ('COL-03', 'Pino Radiata', 900, 900);

insert into lineas (nombre, consumo_acumulado) values
  ('Línea 1 · Descortezado', 0),
  ('Línea 2 · Astillado', 0),
  ('Línea 3 · Aserradero', 0),
  ('Línea 4 · Biomasa', 0);
