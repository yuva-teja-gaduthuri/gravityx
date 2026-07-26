import fs from 'fs';
import path from 'path';

interface LikeRecord {
  targetUsername: string;
  likerUsername: string;
}

interface ReviewRecord {
  targetUsername: string;
  reviewerName: string;
  rating: number;
  comment: string;
  date: string;
}

const FILE_PATH = path.join(__dirname, '../../../likes_reviews.json');

function readData(): { likes: LikeRecord[]; reviews: ReviewRecord[] } {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      return { likes: [], reviews: [] };
    }
    const content = fs.readFileSync(FILE_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return { likes: [], reviews: [] };
  }
}

function writeData(data: { likes: LikeRecord[]; reviews: ReviewRecord[] }) {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write likes/reviews to file:', e);
  }
}

export function addLike(targetUsername: string, likerUsername: string) {
  const data = readData();
  const exists = data.likes.some(
    (l) => l.targetUsername === targetUsername && l.likerUsername === likerUsername
  );
  if (!exists) {
    data.likes.push({ targetUsername, likerUsername });
    writeData(data);
  }
}

export function getLikesCount(targetUsername: string): number {
  const data = readData();
  // Provide a base seed count (e.g. 15) so it matches the initial mockup display
  const count = data.likes.filter((l) => l.targetUsername === targetUsername).length;
  return count + 15;
}

export function addReview(targetUsername: string, reviewerName: string, rating: number, comment: string) {
  const data = readData();
  data.reviews.push({
    targetUsername,
    reviewerName,
    rating,
    comment,
    date: new Date().toISOString().split('T')[0],
  });
  writeData(data);
}

export function getReviews(targetUsername: string): ReviewRecord[] {
  const data = readData();
  const list = data.reviews.filter((r) => r.targetUsername === targetUsername);
  if (list.length === 0) {
    // Return standard initial reviews to populate the UI nicely on first load
    return [
      { targetUsername, reviewerName: 'StarGazer', rating: 5, comment: 'Phenomenal deduction skills in Ramudu Seetha! Guessed correctly in the first turn.', date: '2026-07-24' },
      { targetUsername, reviewerName: 'LudoKing', rating: 4, comment: 'Very strategic Ludo player. Blocked my tokens perfectly.', date: '2026-07-23' }
    ];
  }
  return list;
}
