SELECT attname FROM pg_attribute WHERE attrelid = 'drugs'::regclass AND attnum > 0 AND NOT attisdropped ORDER BY attnum;
