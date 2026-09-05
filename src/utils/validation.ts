import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['teacher', 'student']),
})

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[0-9]/, 'Password must contain a number'),
    confirmPassword: z.string(),
    role: z.enum(['teacher', 'student']),
    rollNumber: z.string().optional(),
    institutionCode: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      })
    }
    if (data.role === 'student' && !data.rollNumber?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Roll number is required',
        path: ['rollNumber'],
      })
    }
    if (data.role === 'teacher' && !data.institutionCode?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Institution code is required',
        path: ['institutionCode'],
      })
    }
  })

export type LoginFormValues = z.infer<typeof loginSchema>
export type RegisterFormValues = z.infer<typeof registerSchema>
