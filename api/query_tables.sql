-- Ver estructura de dyna_budget
DESCRIBE dyna_budget;

-- Ver estructura de dyna_transactions
DESCRIBE dyna_transactions;

-- Ver datos de ejemplo para el mapeo
SELECT DISTINCT IdRegional, Regional 
FROM dyna_transactions 
WHERE Regional != '' 
LIMIT 20;
