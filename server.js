
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const db = require("./db");
console.log("🔥 APPLY LOAN SERVER VERSION 2 LOADED");


// 2️⃣ APP SETUP
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));   

// 3️⃣ DATABASE CONNECTION

db.connect(err => {
  if (err) console.log(err);
  else console.log("MySQL connected");
});

// 4️⃣ FILE UPLOAD CONFIG
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({ storage });


// 5️⃣ ROUTES START HERE

// Test
app.get("/", (req, res) => {
  res.send("Backend running");
});

// Student signup
app.post("/signup", (req, res) => {

  const { name, email, password } = req.body;

  const sql = `
    INSERT INTO users (name, email, password)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [name, email, password], (err, result) => {

    if (err) {
      console.error("Signup error:", err);
      return res.status(500).json({ message: "Signup failed" });
    }

    // ✅ IMPORTANT: result is available HERE
    res.json({
      message: "Signup successful",
      user_id: result.insertId
    });

  });

});



// Student login
app.post("/login", (req, res) => {

  const { email, password } = req.body;

  const sql = `
    SELECT * FROM users 
    WHERE email = ? AND password = ?
  `;

  db.query(sql, [email, password], (err, result) => {

    if (err) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "Login failed" });
    }

    if (result.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({
      message: "Login successful",
      user_id: result[0].id
    });

  });

});


   


// 🔴 APPLY LOAN + DOCUMENT UPLOAD (IMPORTANT)

// ================= ADMIN ROUTES =================

// Admin login
app.post("/admin/login", (req, res) => {
  const { email, password } = req.body;

  const sql = "SELECT * FROM admins WHERE email = ?";

  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    const admin = results[0];

    // since you stored plain password (admin123)
    if (password !== admin.password) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    res.json({ message: "Admin login successful" });
  });
});



// Get all loan applications
app.get("/admin/loans", (req, res) => {
  db.query("SELECT * FROM loan_applications", (err, results) => {
    if (err) {
      return res.status(500).json({ message: "Database error" });
    }
    res.json(results);
  });
});

// Update loan status
app.post("/admin/update-loan", (req, res) => {
  const { id, status } = req.body;

  db.query(
    "UPDATE loan_applications SET status = ? WHERE id = ?",
    [status, id],
    err => {
      if (err) {
        return res.status(500).json({ message: "Update failed" });
      }
      res.json({ message: "Loan status updated" });
    }
  );
});
app.post(
  "/upload-documents",
  upload.fields([
    { name: "aadhaar", maxCount: 1 },
    { name: "pan", maxCount: 1 }
  ]),
  (req, res) => {
    const { employment } = req.body;
    const userId = req.body.user_id; // temporary

    if (!req.files.aadhaar || !req.files.pan) {
      return res.status(400).json({ message: "Files missing" });
    }

    const aadhaarPath = req.files.aadhaar[0].filename;
    const panPath = req.files.pan[0].filename;

    const sql = `
  INSERT INTO user_documents
  (user_id, employment_status, aadhaar_file, pan_file)
  VALUES (?, ?, ?, ?)
`;


    db.query(
      sql,
      [userId, employment, aadhaarPath, panPath],
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Database error" });
        }
        res.json({ message: "Documents saved successfully" });
      }
    );
  }
);

// ===============================
// LOAN APPLICATION API
// ===============================
app.post("/apply-loan", (req, res) => {
   console.log("🚀 APPLY LOAN ROUTE HIT");
  console.log("BODY:", req.body);

  const {
    user_id,
    amount,
    purpose,
    duration,
    interest,
    total
  } = req.body;

  if (!amount || !purpose || !duration) {
    return res.status(400).json({ message: "Missing loan data" });
  }

  const sql = `
    INSERT INTO loan_applications
    (user_id, amount, purpose, duration, interest, total_amount)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [user_id, amount, purpose, duration, interest, total],
    (err) => {
      if (err) {
        console.error("Loan DB error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      res.json({ message: "Loan application submitted successfully" });
    }
  );
});


app.post("/profile", (req, res) => {
  const {
    user_id,
    phone,
    secondary_phone,
    address,
    nationality,
    dob
  } = req.body;

  const sql = `
    INSERT INTO user_profiles
    (user_id, phone, secondary_phone, address, nationality, dob)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [user_id, phone, secondary_phone, address, nationality, dob],
    err => {
      if (err) return res.status(500).json({ message: "Profile save failed" });
      res.json({ message: "Profile saved successfully" });
    }
  );
});





// GET USER LATEST LOAN
app.get("/user-loan/:userId", (req, res) => {
  const userId = req.params.userId;

  const sql = `
    SELECT * FROM loan_applications 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length === 0) {
      return res.json(null);
    }

    res.json(results[0]);
  });
});
// SAVE BASIC DETAILS
app.post("/basic-details", (req, res) => {

    const { user_id, phone, address, dob } = req.body;

    const sql = `
        INSERT INTO user_profiles (user_id, phone, address, dob)
        VALUES (?, ?, ?, ?)
    `;

    db.query(sql, [user_id, phone, address, dob], (err, result) => {
        if (err) {
            console.error("DB error:", err);
            return res.status(500).json({ message: "Database error" });
        }

        res.json({ message: "Basic details saved" });
    });

});

// SAVE BANK DETAILS
app.post("/bank-details", (req, res) => {

  const { user_id, bank_name, branch, account_number, ifsc } = req.body;

  const sql = `
    INSERT INTO bank_details 
    (user_id, bank_name, branch, account_number, ifsc)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sql, [user_id, bank_name, branch, account_number, ifsc], 
  (err, result) => {

    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json({ message: "Bank details saved successfully" });

  });

});
// SAVE DOCUMENTS
// SAVE DOCUMENTS
app.post(
  "/documents",
  upload.fields([
    { name: "aadhaar_file", maxCount: 1 },
    { name: "pan_file", maxCount: 1 },
    { name: "salary_slip_1", maxCount: 1 },
    { name: "salary_slip_2", maxCount: 1 },
    { name: "salary_slip_3", maxCount: 1 }
  ]),
  async (req, res) => {
    try {

      const { user_id, employment_status } = req.body;

      if (!req.files?.aadhaar_file || !req.files?.pan_file) {
        return res.status(400).json({ message: "Files missing" });
      }

      const aadhaarFile = req.files.aadhaar_file[0].filename;
      const panFile = req.files.pan_file[0].filename;

      // Salary slips optional
      const salary1 = req.files.salary_slip_1?.[0]?.filename || null;
      const salary2 = req.files.salary_slip_2?.[0]?.filename || null;
      const salary3 = req.files.salary_slip_3?.[0]?.filename || null;

      const sql = `
        INSERT INTO user_documents
        (user_id, employment_status, aadhaar_file, pan_file, salary_slip_1, salary_slip_2, salary_slip_3)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(
        sql,
        [user_id, employment_status, aadhaarFile, panFile, salary1, salary2, salary3],
        (err) => {
          if (err) {
            console.error("DB Error:", err);
            return res.status(500).json({ message: "Database error" });
          }

          res.json({ message: "Documents saved successfully" });
        }
      );

    } catch (err) {
      console.error("Server crash:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);


// ===============================
// GET USER PROFILE
// ===============================
app.get("/get-profile/:userId", (req, res) => {

  const userId = req.params.userId;

  const sql = `
    SELECT u.name, u.email,
           p.phone, p.address, p.nationality, p.dob
    FROM users u
    LEFT JOIN user_profiles p
    ON u.id = p.user_id
    WHERE u.id = ?
  `;

  db.query(sql, [userId], (err, results) => {

    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(results[0]);

  });

});

// ===============================
// GET USER TRANSACTIONS
// ===============================
app.get("/user-transactions/:userId", (req, res) => {

  const userId = req.params.userId;

  const sql = `
    SELECT * FROM transactions
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;

  db.query(sql, [userId], (err, results) => {

    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);

  });

});


// ===============================
// CREATE SUPPORT TICKET
// ===============================
app.post("/create-ticket", (req, res) => {

  const { user_id, name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ message: "All fields required" });
  }

  const sql = `
    INSERT INTO support_tickets
    (user_id, name, email, message)
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql, [user_id, name, email, message], (err) => {

    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json({ message: "Support request submitted successfully" });

  });

});

// 6️⃣ SERVER START (LAST LINE ONLY)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
