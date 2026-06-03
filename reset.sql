INSERT INTO users (id, email, password, role, "isActive", "createdAt", "updatedAt")
VALUES (
  'user_admin',
  'admin@propcrm.io',
  '$2a$12$4wTeew2qE8uehXl6kJq.r.w7a86ePetXaakqP/mrVW7CvZuQ7oSIK',
  'admin',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE
  SET password   = '$2a$12$4wTeew2qE8uehXl6kJq.r.w7a86ePetXaakqP/mrVW7CvZuQ7oSIK',
      "isActive" = true;

SELECT id, email, role, "isActive" FROM users WHERE email = 'admin@propcrm.io';
