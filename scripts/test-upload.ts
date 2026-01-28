// Test script to verify upload and processing flow
// Run with: npx tsx scripts/test-upload.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabase() {
  console.log('🔍 Testing Supabase connection...\n');

  // Test 1: Check storage bucket
  console.log('1️⃣ Testing Storage bucket "documents"...');
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) {
    console.error('   ❌ Failed to list buckets:', bucketsError.message);
  } else {
    const docBucket = buckets.find(b => b.name === 'documents');
    if (docBucket) {
      console.log('   ✅ Bucket "documents" exists, public:', docBucket.public);
    } else {
      console.error('   ❌ Bucket "documents" not found!');
    }
  }

  // Test 2: List files in bucket
  console.log('\n2️⃣ Listing files in storage...');
  const { data: files, error: filesError } = await supabase.storage.from('documents').list();
  if (filesError) {
    console.error('   ❌ Failed to list files:', filesError.message);
  } else {
    console.log(`   ✅ Found ${files.length} files in storage`);
    files.slice(0, 5).forEach(f => console.log(`      - ${f.name} (${f.metadata?.size || 'unknown'} bytes)`));
  }

  // Test 3: Check documents table
  console.log('\n3️⃣ Testing documents table...');
  const { data: docs, error: docsError } = await supabase.from('documents').select('*').limit(5);
  if (docsError) {
    console.error('   ❌ Failed to query documents:', docsError.message);
    console.error('   Details:', docsError);
  } else {
    console.log(`   ✅ Found ${docs.length} records in documents table`);
    docs.forEach(d => console.log(`      - ID ${d.id}: ${d.filename} (${d.status})`));
  }

  // Test 4: Check chunks table
  console.log('\n4️⃣ Testing chunks table...');
  const { data: chunks, error: chunksError } = await supabase.from('chunks').select('id, document_id, content').limit(3);
  if (chunksError) {
    console.error('   ❌ Failed to query chunks:', chunksError.message);
    console.error('   Details:', chunksError);
  } else {
    console.log(`   ✅ Found ${chunks.length} chunks in database`);
    chunks.forEach(c => console.log(`      - Chunk ${c.id} (doc ${c.document_id}): "${c.content.slice(0, 50)}..."`));
  }

  // Test 5: Test insert to documents table
  console.log('\n5️⃣ Testing INSERT to documents table...');
  const testDoc = {
    filename: 'test-connection.pdf',
    storage_path: 'test-path-' + Date.now(),
    file_size: 1234,
    status: 'pending'
  };
  const { data: insertData, error: insertError } = await supabase
    .from('documents')
    .insert(testDoc)
    .select('id')
    .single();

  if (insertError) {
    console.error('   ❌ Failed to INSERT:', insertError.message);
    console.error('   Code:', insertError.code);
    console.error('   Details:', insertError.details);
    console.error('   Hint:', insertError.hint);
  } else {
    console.log('   ✅ INSERT successful, ID:', insertData.id);

    // Test 6: Test UPDATE
    console.log('\n6️⃣ Testing UPDATE on documents table...');
    const { error: updateError } = await supabase
      .from('documents')
      .update({ status: 'indexed' })
      .eq('id', insertData.id);

    if (updateError) {
      console.error('   ❌ Failed to UPDATE:', updateError.message);
      console.error('   This means processing will fail! Run this SQL in Supabase:');
      console.error('   CREATE POLICY "Allow anonymous document updates" ON documents FOR UPDATE TO anon USING (true) WITH CHECK (true);');
    } else {
      console.log('   ✅ UPDATE successful');
    }

    // Cleanup
    await supabase.from('documents').delete().eq('id', insertData.id);
    console.log('   🧹 Cleaned up test record');
  }

  console.log('\n✅ Tests complete!');
}

testSupabase().catch(console.error);
