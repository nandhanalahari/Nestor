alter table if exists holdings
  add column if not exists cost_basis_date date null;
