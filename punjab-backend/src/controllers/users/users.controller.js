//apply for a new role
  const applyForRole = async (req, res) => {
    try {
      const { role } = req.body;
      const userId = req.user.id;

      // Validate the role
      if (!role || !["EDITOR", "AUTHOR"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role. Must be either 'EDITOR' or 'AUTHOR'.",
        });
      }

      // Check if the user already has a pending application for this role
      const existingApplication = await RoleApplication.findOne({
        where: { userId, role, status: "PENDING" },
      });

      if (existingApplication) {
        return res.status(400).json({
          success: false,
          message: `You already have a pending application for the ${role} role.`,
        });
      }

      // Create a new role application
      const newApplication = await RoleApplication.create({
        userId,
        role,
        status: "PENDING",
      });

      return res.status(201).json({
        success: true,
        message: `Your application for the ${role} role has been submitted successfully.`,
        application: newApplication,
      });
    } catch (error) {
      console.error("Error applying for role:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while processing your application.",
      });
    }
  };    

  module.exports = {
    applyForRole,
  };