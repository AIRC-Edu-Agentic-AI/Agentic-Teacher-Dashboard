import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import dns from 'dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config();

const uri = process.env.MONGODB_URI;

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('oulad_db');
    const classrooms = await db.collection('classrooms').find({}).toArray();
    console.log("CLASSROOMS:", JSON.stringify(classrooms.map(c => ({ name: c.name, module: c.module, code_presentation: c.code_presentation, student_count: c.student_ids?.length }))));
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
run();
