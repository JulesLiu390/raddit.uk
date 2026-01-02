require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/raddit';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  try {
    console.log('Connecting to:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. List all users
    const users = await User.find({});
    
    if (users.length === 0) {
      console.log('No users found in the database.');
      return;
    }

    const PAGE_SIZE = 10;
    let currentPage = 0;
    const totalPages = Math.ceil(users.length / PAGE_SIZE);

    while (true) {
      console.log(`\n=== Registered Users (Page ${currentPage + 1}/${totalPages}) ===`);
      const start = currentPage * PAGE_SIZE;
      const end = Math.min(start + PAGE_SIZE, users.length);
      
      for (let i = start; i < end; i++) {
        const user = users[i];
        console.log(`${i + 1}. ${user.name} (${user.email}) [ID: ${user._id}]`);
      }
      console.log('=============================================');
      
      let prompt = 'Enter number to delete';
      if (currentPage < totalPages - 1) prompt += ', "n" for next page';
      if (currentPage > 0) prompt += ', "p" for prev page';
      prompt += ', or "q" to quit: ';

      const answer = await new Promise(resolve => rl.question(prompt, resolve));
      const input = answer.trim().toLowerCase();

      if (input === 'q') {
        console.log('Operation cancelled.');
        closeAndExit();
        return;
      } else if (input === 'n' && currentPage < totalPages - 1) {
        currentPage++;
      } else if (input === 'p' && currentPage > 0) {
        currentPage--;
      } else {
        const choice = parseInt(input);
        if (!isNaN(choice) && choice >= 1 && choice <= users.length) {
          const userToDelete = users[choice - 1];
          
          const confirm = await new Promise(resolve => {
            rl.question(`Are you sure you want to delete "${userToDelete.name}"? (y/N): `, resolve);
          });

          if (confirm.toLowerCase() === 'y') {
            await User.findByIdAndDelete(userToDelete._id);
            console.log(`Successfully deleted user: ${userToDelete.name}`);
            // Refresh list or exit? Let's exit to be safe/simple
            closeAndExit();
            return;
          } else {
            console.log('Deletion cancelled.');
          }
        } else {
          console.log('Invalid input.');
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
    closeAndExit();
  }
}

async function closeAndExit() {
  await mongoose.disconnect();
  console.log('Disconnected');
  rl.close();
  process.exit(0);
}

main();
