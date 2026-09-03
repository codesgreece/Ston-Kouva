import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(3, "Το username πρέπει να έχει τουλάχιστον 3 χαρακτήρες")
  .max(20, "Το username πρέπει να έχει το πολύ 20 χαρακτήρες")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Μόνο γράμματα, αριθμοί και underscore",
  );

export const emailSchema = z
  .string()
  .email("Μη έγκυρο email")
  .max(255);

export const passwordSchema = z
  .string()
  .min(8, "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες")
  .max(128, "Ο κωδικός είναι πολύ μεγάλος");

export const displayNameSchema = z
  .string()
  .min(1, "Το display name είναι υποχρεωτικό")
  .max(80);

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema.optional(),
});

export const loginSchema = z.object({
  login: z.string().min(1, "Συμπλήρωσε email ή username"),
  password: z.string().min(1, "Συμπλήρωσε κωδικό"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
