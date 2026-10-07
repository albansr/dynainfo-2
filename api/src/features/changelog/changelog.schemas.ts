import { Type } from '@sinclair/typebox';

const CategorySchema = Type.Union([
  Type.Literal('nuevo'),
  Type.Literal('mejorado'),
  Type.Literal('corregido'),
]);

export const ChangelogEntriesResponseSchema = Type.Object({
  entries: Type.Array(
    Type.Object({
      id: Type.String(),
      date: Type.String(),
      title: Type.String(),
      summary: Type.Optional(Type.String()),
      image: Type.Optional(Type.Object({ src: Type.String(), alt: Type.String() })),
      changes: Type.Array(
        Type.Object({
          category: CategorySchema,
          items: Type.Array(Type.String()),
        }),
      ),
    }),
  ),
});

export const SubscribeBodySchema = Type.Object({
  email: Type.String({ format: 'email', maxLength: 254 }),
  // Honeypot: real users never see or fill this; bots do
  website: Type.Optional(Type.String({ maxLength: 254 })),
});

export const UnsubscribeQuerySchema = Type.Object({
  token: Type.String({ minLength: 1, maxLength: 128 }),
});

export const OkResponseSchema = Type.Object({ ok: Type.Boolean() });
