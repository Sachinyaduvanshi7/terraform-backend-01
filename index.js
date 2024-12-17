const express = require("express");
const bodyParser = require("body-parser");
const { exec } = require("child_process");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = 5000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Function to execute shell commands
const executeCommand = (command, cwd) =>
  new Promise((resolve, reject) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(stderr);
      } else {
        resolve(stdout);
      }
    });
  });

// POST endpoint to create infrastructure and load data
app.post("/api/infra", async (req, res) => {
  const { keyword } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: "Keyword is required" });
  }

  const bucketName = `${keyword.toLowerCase()}-bucket`; // Example naming
  const terraformPath =
    "D:/aws-devops/terraform/keyword_infra/terraform-backend/terraform";

  try {
    // 1. Initialize and apply Terraform configuration
    console.log("Running Terraform...");
    await executeCommand(
      `terraform init && terraform apply -var="bucket_name=${bucketName}" -auto-approve`,
      terraformPath
    );

    console.log("Terraform applied successfully.");

    // 2. Fetch Terraform outputs
    const outputStdout = await executeCommand(
      `terraform output -json`,
      terraformPath
    );
    const outputs = JSON.parse(outputStdout);

    console.log("Terraform outputs retrieved successfully.");

    // 3. Get the app and db endpoints
    const appEndpoint = outputs.app_endpoint.value; // Example output key
    const dbEndpoint = outputs.db_endpoint.value; // Example output key

    // 4. Trigger data load process
    console.log("Triggering data load...");
    await loadData(keyword, appEndpoint, dbEndpoint);

    res.json({
      message: "Infrastructure created and data loaded successfully",
      appEndpoint,
      dbEndpoint,
    });
  } catch (error) {
    console.error("Error in infrastructure creation or data loading:", error);
    res.status(500).json({
      error: "Infrastructure creation or data loading failed",
      details: error,
    });
  }
});

// Function to load data into the infrastructure (assuming appEndpoint and dbEndpoint)
const loadData = async (keyword, appEndpoint, dbEndpoint) => {
  // Ensure the appEndpoint has the correct protocol (http:// or https://)
  const url =
    appEndpoint.startsWith("http://") || appEndpoint.startsWith("https://")
      ? appEndpoint
      : `http://${appEndpoint}`;

  try {
    console.log(`Sending data to app endpoint: ${url}`);
    const response = await axios.post(`${url}/load-data`, {
      keyword,
      dbEndpoint,
    });

    console.log("Data loaded successfully:", response.data);
  } catch (err) {
    console.error("Error-1 loading data:", err.message);
  }
};

// New POST endpoint to handle /load-data
app.post("/load-data", (req, res) => {
  console.log("Data received at /load-data:", req.body);
  res.json({ message: "Data received", data: req.body });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
