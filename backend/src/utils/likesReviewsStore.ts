import prisma from './prisma';

export async function addLike(targetUsername: string, likerUsername: string): Promise<void> {
  try {
    await prisma.userLike.upsert({
      where: {
        targetUsername_likerUsername: { targetUsername, likerUsername },
      },
      update: {},
      create: { targetUsername, likerUsername },
    });
  } catch (e: any) {
    console.error('Failed to add user like in DB:', e.message);
  }
}

export async function getLikesCount(targetUsername: string): Promise<number> {
  try {
    const count = await prisma.userLike.count({
      where: { targetUsername },
    });
    return count;
  } catch (e: any) {
    console.error('Failed to get likes count from DB:', e.message);
    return 0;
  }
}

export async function addReview(targetUsername: string, reviewerName: string, rating: number, comment: string): Promise<void> {
  try {
    await prisma.userReview.create({
      data: { targetUsername, reviewerName, rating, comment },
    });
  } catch (e: any) {
    console.error('Failed to add user review in DB:', e.message);
  }
}

export async function getReviews(targetUsername: string): Promise<any[]> {
  try {
    const list = await prisma.userReview.findMany({
      where: { targetUsername },
      orderBy: { createdAt: 'desc' },
    });

    return list.map(r => ({
      targetUsername: r.targetUsername,
      reviewerName: r.reviewerName,
      rating: r.rating,
      comment: r.comment,
      date: r.createdAt.toISOString().split('T')[0],
    }));
  } catch (e: any) {
    console.error('Failed to get reviews from DB:', e.message);
    return [];
  }
}

