export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Forbidden: insufficient role",
      });
    }

    next();
  };
}

export function allowOperatorAccess(...levels) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== "NORMAL_SELLER") {
      return res.status(403).json({
        message: "Forbidden: operator account required",
      });
    }

    if (!levels.includes(req.user.operatorAccessLevel)) {
      return res.status(403).json({
        message: "Forbidden: insufficient operator access level",
      });
    }

    next();
  };
}

export function allowMasterOrOperatorAccess(...levels) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({
        message: "Forbidden",
      });
    }

    if (req.user.role === "MASTER_SELLER") {
      return next();
    }

    if (req.user.role !== "NORMAL_SELLER") {
      return res.status(403).json({
        message: "Forbidden: operator account required",
      });
    }

    if (!levels.includes(req.user.operatorAccessLevel)) {
      return res.status(403).json({
        message: "Forbidden: insufficient operator access level",
      });
    }

    next();
  };
}