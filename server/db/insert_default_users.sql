-- Replace HASH_HERE with actual bcrypt hashes generated earlier

INSERT INTO users (username, password_hash, ms_email, role) VALUES
  ('admin',   '$2b$10$HSt4cn7Wehx9n6wcqESAr.hM09shTNwnX5hm/bhp3gmGarK9FkQQS',   'joshuajojejo@outlook.com',   'admin'),
  ('clientA', '$2b$10$FVYRu4N1wKEP2rr99clKSuhBv1QP/z20BfK/YTyue3yj6V/Jukncu', 'ak_nixon@live.concordia.ca', 'CLIENTA'),
  ('clientB', '$2b$10$JWgnfFWodiLwp.OL1HW5Su8SB.ivXH.70bH6RLJiE6DXygL5uZAiO', NULL,                          'CLIENTB');
