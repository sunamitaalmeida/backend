ALTER TABLE `usuarios`
    ADD COLUMN `papel` VARCHAR(20) NOT NULL DEFAULT 'consulta' AFTER `senha_hash`;
