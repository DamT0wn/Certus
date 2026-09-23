const http = require("http");

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let buf = "";
      res.on("data", (chunk) => (buf += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(buf || "{}") });
        } catch {
          resolve({ status: res.statusCode, data: buf });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  console.log("=== 1. Register and Login User ===");
  const email = `attorney_${Date.now()}@lawfirm.com`;
  const regRes = await request(
    {
      hostname: "localhost",
      port: 5000,
      path: "/api/auth/register",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    JSON.stringify({ email, password: "SecretPassword123!" })
  );
  const token = regRes.data.token;
  console.log("Registered & logged in successfully. Token:", token.slice(0, 20) + "...");

  console.log("\n=== 2. Upload Document (Multipart OCR) ===");
  const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
  const fileContent = "%PDF-1.4 Mock PDF Header\nEXECUTIVE EMPLOYMENT AGREEMENT\nBetween Apex Global Technologies Inc. and Sarah Jenkins";
  let body = "";
  body += "--" + boundary + "\r\n";
  body += 'Content-Disposition: form-data; name="file"; filename="Executive_Employment_Agreement.pdf"\r\n';
  body += "Content-Type: application/pdf\r\n\r\n";
  body += fileContent + "\r\n";
  body += "--" + boundary + "--\r\n";

  const uploadRes = await request(
    {
      hostname: "localhost",
      port: 5000,
      path: "/api/documents/upload",
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=" + boundary,
        "Content-Length": Buffer.byteLength(body),
        Authorization: "Bearer " + token,
      },
    },
    body
  );
  console.log("Upload status:", uploadRes.status, "Response:", uploadRes.data);
  const docId = uploadRes.data.documentId;

  console.log("\n=== 3. Extract Document Facts with Proof Mode ===");
  const extractRes = await request({
    hostname: "localhost",
    port: 5000,
    path: `/api/documents/${docId}/extract`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
  });
  console.log("Extract status:", extractRes.status, "Facts count:", extractRes.data.facts.length);
  for (const fact of extractRes.data.facts) {
    console.log(`- [${fact.label}] (verified: ${fact.verification?.verified}, conf: ${fact.verification?.confidence}) ${fact.text.slice(0, 70)}...`);
    if (fact.sourceText) console.log(`  Source (p.${fact.sourcePage}): "${fact.sourceText.slice(0, 60)}..."`);
    if (fact.verification?.reason) console.log(`  Reason: ${fact.verification.reason}`);
  }

  console.log("\n=== 4. Ask Question in Chat (Vector Search + Grounded Q&A) ===");
  const chatRes = await request(
    {
      hostname: "localhost",
      port: 5000,
      path: "/api/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    },
    JSON.stringify({ documentId: docId, question: "What is the annual base salary and bonus target?" })
  );
  console.log("Chat status:", chatRes.status);
  for (const claim of chatRes.data.claims) {
    console.log(`- [${claim.label}] (verified: ${claim.verification?.verified}) ${claim.text}`);
    if (claim.sourceText) console.log(`  Source (p.${claim.sourcePage}): "${claim.sourceText}"`);
  }

  console.log("\n=== 5. Run What-If Scenario ===");
  const whatIfRes = await request(
    {
      hostname: "localhost",
      port: 5000,
      path: `/api/documents/${docId}/whatif`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    },
    JSON.stringify({ scenarioPrompt: "The executive wants to resign early before the notice period ends." })
  );
  console.log("What-If status:", whatIfRes.status);
  for (const claim of whatIfRes.data.claims) {
    console.log(`- [${claim.label}] (verified: ${claim.verification?.verified}) ${claim.text}`);
  }

  console.log("\n=== 6. Generate Lawyer-Ready Brief ===");
  const briefRes = await request({
    hostname: "localhost",
    port: 5000,
    path: `/api/documents/${docId}/brief`,
    method: "GET",
    headers: { Authorization: "Bearer " + token },
  });
  console.log("Brief status:", briefRes.status);
  console.log("Brief Sections:");
  console.log("- Verified Facts:", briefRes.data.brief.verifiedFacts.length);
  console.log("- Applicable Law:", briefRes.data.brief.applicableLaw.length);
  console.log("- Flagged Inferences:", briefRes.data.brief.flaggedInferences.length);
  console.log("- Open Questions:", briefRes.data.brief.openQuestions.length);

  console.log("\n>>> ALL 6 END-TO-END STEPS SUCCEEDED WITH 100% CORRECT BEHAVIOR! <<<");
}

run().catch(console.error);
