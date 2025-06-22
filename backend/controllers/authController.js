const User = require("../models/User")
const { validationResult } = require("express-validator")
const emailService = require("../services/emailService")

// Register new user (simple email signup)
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { email, name } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with this email" })
    }

    // Create new user
    const user = new User({
      email,
      name,
      points: 1000,
    })

    await user.save()

    // Send welcome email
    await emailService.sendWelcomeEmail(user)

    res.status(201).json({
      message: "Registration successful! Check your email for welcome message.",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        points: user.points,
      },
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({ message: "Server error during registration" })
  }
}
