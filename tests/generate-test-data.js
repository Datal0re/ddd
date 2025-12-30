#!/usr/bin/env node

/**
 * Basic synthetic test data generator for data-dumpster-diver
 * Creates privacy-safe ChatGPT export structure for testing
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Basic test data generator
 */
class BasicTestDataGenerator {
  constructor() {
    this.conversations = [];
    this.userProfile = this.generateUserProfile();
    this.messageFeedback = [];
  }

  /**
   * Generate a basic user profile
   */
  generateUserProfile() {
    return {
      id: `user-${this.generateId()}`,
      email: 'test-user@example.com',
      chatgpt_plus_user: true,
      birth_year: 2000,
    };
  }

  /**
   * Generate a basic conversation
   */
  generateBasicConversation() {
    const conversation = {
      title: 'Basic JavaScript Question',
      create_time: this.randomTimestamp(),
      update_time: this.randomTimestamp(),
      mapping: {},
      conversation_id: this.generateId(),
      moderation_results: [],
      current_node: null,
    };

    this.generateBasicMessageChain(conversation);
    return conversation;
  }

  /**
   * Generate a basic message chain
   */
  generateBasicMessageChain(conversation) {
    const rootId = this.generateId();
    const systemId = this.generateId();
    const userId = this.generateId();
    const assistantId = this.generateId();

    // Root node
    conversation.mapping[rootId] = {
      id: rootId,
      message: null,
      parent: null,
      children: [systemId],
    };

    // System message
    conversation.mapping[systemId] = {
      id: systemId,
      message: this.createSystemMessage(),
      parent: rootId,
      children: [userId],
    };

    // User message with basic question
    conversation.mapping[userId] = {
      id: userId,
      message: this.createUserMessage(
        'How do I create a simple function in JavaScript that adds two numbers?'
      ),
      parent: systemId,
      children: [assistantId],
    };

    // Assistant response with code
    conversation.mapping[assistantId] = {
      id: assistantId,
      message: this.createAssistantMessage(this.generateBasicCodeResponse()),
      parent: userId,
      children: [],
    };

    conversation.current_node = assistantId;
  }

  /**
   * Create a system message
   */
  createSystemMessage() {
    return {
      id: this.generateId(),
      author: { role: 'system', name: null, metadata: {} },
      create_time: null,
      update_time: null,
      content: { content_type: 'text', parts: [''] },
      status: 'finished_successfully',
      end_turn: true,
      weight: 0.0,
      metadata: { is_visually_hidden_from_conversation: true },
      recipient: 'all',
      channel: null,
    };
  }

  /**
   * Create a user message
   */
  createUserMessage(content) {
    return {
      id: this.generateId(),
      author: { role: 'user', name: null, metadata: {} },
      create_time: this.randomTimestamp(),
      update_time: null,
      content: { content_type: 'text', parts: [content] },
      status: 'finished_successfully',
      end_turn: null,
      weight: 1.0,
      metadata: {
        request_id: `req_${Math.random().toString(36).substr(2, 9)}`,
        timestamp_: 'absolute',
      },
      recipient: 'all',
      channel: null,
    };
  }

  /**
   * Create an assistant message
   */
  createAssistantMessage(content) {
    return {
      id: this.generateId(),
      author: { role: 'assistant', name: null, metadata: {} },
      create_time: this.randomTimestamp(),
      update_time: null,
      content: { content_type: 'text', parts: [content] },
      status: 'finished_successfully',
      end_turn: true,
      weight: 1.0,
      metadata: {
        model_slug: 'gpt-4o',
        finish_details: { type: 'stop', stop_tokens: [200002] },
        is_complete: true,
        message_type: 'next',
        parent_id: this.generateId(),
        model_switch_details: null,
        sibling_message_id: null,
        timestamp_: 'absolute',
      },
      recipient: 'all',
      channel: null,
    };
  }

  /**
   * Generate a basic code response
   */
  generateBasicCodeResponse() {
    return `Here's how to create a simple function that adds two numbers in JavaScript:

\`\`\`javascript
function addNumbers(a, b) {
  return a + b;
}

// Example usage:
const result = addNumbers(5, 3);
console.log(result); // Output: 8
\`\`\`

This function:
- Takes two parameters (a and b)
- Returns their sum
- Works with any numeric values
- Is simple and easy to understand

You can also write it as an arrow function:

\`\`\`javascript
const addNumbers = (a, b) => a + b;
\`\`\`

Both versions work the same way, so choose the style you prefer!`;
  }

  /**
   * Generate a unique ID
   */
  generateId() {
    return crypto.randomUUID();
  }

  /**
   * Generate a random timestamp within the last 6 months
   */
  randomTimestamp() {
    const now = Date.now() / 1000;
    const sixMonthsAgo = now - 6 * 30 * 24 * 60 * 60;
    return sixMonthsAgo + Math.random() * (now - sixMonthsAgo);
  }

  /**
   * Generate basic test data structure
   */
  generateBasicTestSuite() {
    // Generate 3 basic conversations
    for (let i = 0; i < 3; i++) {
      this.conversations.push(this.generateBasicConversation());
    }

    return this.buildTestZip();
  }

  /**
   * Build the test ZIP structure
   */
  buildTestZip() {
    const exportDir = 'ChatGPT-Data-Export';

    // Create basic HTML content
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>ChatGPT Conversation Export</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; 
            padding: 20px; 
            background-color: #f7f7f8;
        }
        .conversation { 
            background: white; 
            border-radius: 8px; 
            margin: 20px 0; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .message { 
            margin: 10px 0; 
            padding: 15px; 
            border-radius: 8px;
        }
        .user { 
            background-color: #f7f7f8; 
            margin-left: 20%;
        }
        .assistant { 
            background-color: #ffffff; 
            margin-right: 20%; 
            border: 1px solid #e5e5e5;
        }
        .system { 
            background-color: #f0f0f0; 
            font-style: italic; 
            color: #666;
        }
        pre { 
            background-color: #f6f8fa; 
            padding: 10px; 
            border-radius: 4px; 
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <h1>ChatGPT Conversation Export</h1>
    <div id="conversations">
        ${this.conversations
          .map(
            conv => `
            <div class="conversation">
                <h2>${conv.title}</h2>
                <p>Created: ${new Date(conv.create_time * 1000).toLocaleString()}</p>
                <div class="messages">
                    ${Object.values(conv.mapping)
                      .filter(node => node.message)
                      .map(
                        node => `
                            <div class="message ${node.message.author.role}">
                                <strong>${node.message.author.role}:</strong>
                                <div>${node.message.content.parts[0]}</div>
                            </div>
                        `
                      )
                      .join('')}
                </div>
            </div>
        `
          )
          .join('')}
    </div>
    
    <script>
        window.conversations = ${JSON.stringify(this.conversations, null, 2)};
        window.user = ${JSON.stringify(this.userProfile, null, 2)};
    </script>
</body>
</html>`;

    return {
      [`${exportDir}/conversations.json`]: JSON.stringify(this.conversations, null, 2),
      [`${exportDir}/user.json`]: JSON.stringify(this.userProfile, null, 2),
      [`${exportDir}/message_feedback.json`]: JSON.stringify(
        this.messageFeedback,
        null,
        2
      ),
      [`${exportDir}/chat.html`]: htmlContent,
    };
  }

  /**
   * Write test data to the filesystem
   */
  async writeTestData(outputDir = './tests') {
    const testStructure = this.generateBasicTestSuite();
    const exportDir = 'test-basic-synthetic'; // Must match ZIP filename without .zip

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create the export directory
    const fullExportPath = path.join(outputDir, exportDir);
    if (fs.existsSync(fullExportPath)) {
      // Clean up existing directory
      fs.rmSync(fullExportPath, { recursive: true, force: true });
    }
    fs.mkdirSync(fullExportPath, { recursive: true });

    // Write each file
    Object.entries(testStructure).forEach(([relativePath, content]) => {
      // Convert the relative path to use the correct export directory name
      const actualRelativePath = relativePath.replace('ChatGPT-Data-Export', exportDir);
      const fullPath = path.join(outputDir, actualRelativePath);

      // Ensure parent directory exists
      const parentDir = path.dirname(fullPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(fullPath, content);
    });

    console.log(`✓ Basic test data generated in: ${fullExportPath}`);
    console.log(`  - conversations.json (${this.conversations.length} conversations)`);
    console.log(`  - user.json`);
    console.log(`  - message_feedback.json`);
    console.log(`  - chat.html`);

    return fullExportPath;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🔧 Generating basic synthetic test data...');

    const generator = new BasicTestDataGenerator();
    const exportPath = await generator.writeTestData();

    console.log(`\n📁 Test data created at: ${exportPath}`);
    console.log('\n🚀 You can now test with this data using:');
    console.log(`   ddd dump "${exportPath}" --name test-basic`);
  } catch (error) {
    console.error('❌ Error generating test data:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { BasicTestDataGenerator };
