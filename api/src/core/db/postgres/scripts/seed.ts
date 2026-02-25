import 'dotenv/config';
import { db } from '../client.js';
import { users } from '../schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../../../logger/logger.js';

/**
 * Seed script - Create initial superadmin user
 *
 * Usage: npm run db:seed
 *
 * Creates a superadmin user with the email specified in SUPERADMIN_EMAIL env variable
 * If user already exists, updates their role to superadmin and activates them
 */
async function seed() {
  const email = process.env['SUPERADMIN_EMAIL'] || 'admin@dynainfo.com';
  const name = process.env['SUPERADMIN_NAME'] || 'Super Admin';

  console.log('🌱 Seeding database...');
  console.log(`📧 Superadmin email: ${email}`);

  try {
    // Check if user already exists
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      console.log('👤 User already exists, updating to superadmin...');

      const [updated] = await db
        .update(users)
        .set({
          role: 'superadmin',
          isActive: true,
          name,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id))
        .returning();

      console.log('✅ User updated successfully!');
      console.log(`   ID: ${updated.id}`);
      console.log(`   Email: ${updated.email}`);
      console.log(`   Name: ${updated.name}`);
      console.log(`   Role: ${updated.role}`);
    } else {
      console.log('👤 Creating new superadmin user...');

      const [newUser] = await db
        .insert(users)
        .values({
          email,
          name,
          role: 'superadmin',
          isActive: true,
          emailVerified: false,
        })
        .returning();

      console.log('✅ Superadmin created successfully!');
      console.log(`   ID: ${newUser.id}`);
      console.log(`   Email: ${newUser.email}`);
      console.log(`   Name: ${newUser.name}`);
      console.log(`   Role: ${newUser.role}`);
    }

    console.log('');
    console.log('📝 Next steps:');
    console.log('   1. Start the server: npm run dev');
    console.log(`   2. Request OTP code: POST /api/auth/email-otp/send-verification-otp with {"email":"${email}","type":"sign-in"}`);
    console.log('   3. Check your email for the 6-digit code');
    console.log('   4. Verify OTP: POST /api/auth/email-otp/verify-email with {"email":"${email}","otp":"123456"}');
    console.log('   5. Use the returned token for authenticated requests');
    console.log('');

    process.exit(0);
  } catch (error) {
    logger.error({
      type: 'seed_error',
      err: error,
    }, '❌ Seed failed');
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
