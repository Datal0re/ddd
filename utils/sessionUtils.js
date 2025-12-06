/*
 * Session Serialization Utility
 * Handles converting sessions Map to/from JSON file
 */
const fs = require("fs").promises;
const path = require("path");

/**
 * Serializes sessions Map to JSON file
 * @param {Map} sessions - Sessions data to serialize
 * @returns {Promise<void>}
 */
async function serializeSessions(sessions) {
  try {
    const filePath = path.join(__dirname, "..", "data", "sessions.json");
    const data = JSON.stringify([...sessions.entries()], null, 2);

    await fs.writeFile(filePath, data);
    console.log("Sessions serialized successfully");
  } catch (error) {
    console.error(
      `Serialization failed: ${error.message} (Code: ${error.code || "N/A"})`,
    );
    // Optional: Re-throw or handle differently based on use case
  }
}

/**
 * Deserializes JSON file to sessions Map
 * @returns {Promise<Map>}
 */
async function deserializeSessions() {
  try {
    const filePath = path.join(__dirname, "..", "data", "sessions.json");
    let data;
    try {
      data = await fs.readFile(filePath, "utf8");
    } catch (err) {
      if (err.code === "ENOENT") {
        // File doesn't exist yet - return empty sessions map
        console.log("Sessions file not found - starting with empty sessions");
        return new Map();
      }
      throw err;
    }

    if (!data || data.trim() === "") {
      console.log("Sessions file is empty - starting with empty sessions");
      return new Map();
    }

    const parsedData = JSON.parse(data);
    const sessions = new Map(
      parsedData.map(([id, info]) => [
        id,
        {
          ...info,
          uploadedAt: new Date(info.uploadedAt)
        }
      ])
    );
    console.log("Sessions deserialized successfully");
    return sessions;
  } catch (error) {
    console.error(
      `Deserialization failed: ${error.message} (Code: ${error.code || "N/A"})`,
    );
    // Return empty map instead of throwing to allow app to start
    return new Map();
  }
}

module.exports = { serializeSessions, deserializeSessions };
