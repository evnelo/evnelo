UPDATE `organizations`
SET `slug` = CONCAT(`slug`, '-', LOWER(`id`))
WHERE `slug` IN ('api', 'dashboard', 'dev', 'discover', 'e', 'invite', 'login', 'o', 'onboarding', 't', 'unsubscribe');
