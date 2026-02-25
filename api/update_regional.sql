-- 1. Agregar la columna Regional a dyna_budget
ALTER TABLE dyna_budget ADD COLUMN IF NOT EXISTS Regional String DEFAULT '';

-- 2. Actualizar todos los registros con el mapeo de dyna_transactions
ALTER TABLE dyna_budget
UPDATE Regional = (
    SELECT Regional 
    FROM dyna_transactions 
    WHERE dyna_transactions.IdRegional = dyna_budget.IdRegional 
    LIMIT 1
)
WHERE IdRegional != '';
