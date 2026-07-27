import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.log('Usage: npx ts-node prisma/makeAdmin.ts <username>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.error(`User '${username}' not found in database.`);
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { username },
    data: { role: 'ADMIN' },
  });

  console.log(`✅ Success! User '${updated.username}' is now a Super Admin (role: ADMIN).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
