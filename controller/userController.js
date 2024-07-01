import { v2 as cloudinary } from "cloudinary";
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import { User } from "../models/userSchema.js";
import ErrorHandler from "../middlewares/error.js";
import { generateToken } from "../utils/jwtToken.js";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";

export const register = catchAsyncErrors(async (req, res, next) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return next(new ErrorHandler("Avatar Required!", 400));
  }
  const { avatar, resume } = req.files;

  try {
    const cloudinaryResponseForAvatar = await cloudinary.uploader.upload(
      avatar.tempFilePath,
      { folder: "PORTFOLIO AVATAR" }
    );
    const cloudinaryResponseForResume = await cloudinary.uploader.upload(
      resume.tempFilePath,
      { folder: "PORTFOLIO RESUME" }
    );

    const {
      fullName,
      email,
      phone,
      aboutMe,
      password,
      portfolioURL,
      githubURL,
      instagramURL,
      twitterURL,
      facebookURL,
      linkedInURL,
    } = req.body;

    const newUser = await User.create({
      fullName,
      email,
      phone,
      aboutMe,
      password,
      portfolioURL,
      githubURL,
      instagramURL,
      twitterURL,
      facebookURL,
      linkedInURL,
      avatar: {
        public_id: cloudinaryResponseForAvatar.public_id,
        url: cloudinaryResponseForAvatar.secure_url,
      },
      resume: {
        public_id: cloudinaryResponseForResume.public_id,
        url: cloudinaryResponseForResume.secure_url,
      },
    });

    generateToken(newUser, "Registered!", 201, res);
  } catch (error) {
    console.error(
      "Cloudinary Error:",
      error.message || "Unknown Cloudinary error"
    );
    return next(new ErrorHandler("Failed to upload files to Cloudinary", 500));
  }
});

export const login = catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new ErrorHandler("Provide Email And Password!", 400));
  }

  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return next(new ErrorHandler("Invalid Email Or Password!", 404));
    }
    const isPasswordMatched = await user.comparePassword(password);
    if (!isPasswordMatched) {
      return next(new ErrorHandler("Invalid Email Or Password", 401));
    }
    generateToken(user, "Login Successfully!", 200, res);
  } catch (error) {
    return next(
      new ErrorHandler(error.message || "Internal Server Error", 500)
    );
  }
});

export const logout = catchAsyncErrors(async (req, res, next) => {
  try {
    res.status(200).cookie("token", "", {
      httpOnly: true,
      expires: new Date(Date.now()),
      sameSite: "None",
      secure: true,
    })({ success: true, message: "Logged Out!" });
  } catch (error) {
    return next(
      new ErrorHandler(error.message || "Internal Server Error", 500)
    );
  }
});

export const getUser = catchAsyncErrors(async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, user });
  } catch (error) {
    return next(
      new ErrorHandler(error.message || "Internal Server Error", 500)
    );
  }
});

export const updateProfile = catchAsyncErrors(async (req, res, next) => {
  const newUserData = {
    fullName: req.body.fullName,
    email: req.body.email,
    phone: req.body.phone,
    aboutMe: req.body.aboutMe,
    githubURL: req.body.githubURL,
    instagramURL: req.body.instagramURL,
    portfolioURL: req.body.portfolioURL,
    facebookURL: req.body.facebookURL,
    twitterURL: req.body.twitterURL,
    linkedInURL: req.body.linkedInURL,
  };

  try {
    if (req.files && req.files.avatar) {
      const avatar = req.files.avatar;
      const user = await User.findById(req.user.id);
      await cloudinary.uploader.destroy(user.avatar.public_id);
      const newProfileImage = await cloudinary.uploader.upload(
        avatar.tempFilePath,
        {
          folder: "PORTFOLIO AVATAR",
        }
      );
      newUserData.avatar = {
        public_id: newProfileImage.public_id,
        url: newProfileImage.secure_url,
      };
    }

    if (req.files && req.files.resume) {
      const resume = req.files.resume;
      const user = await User.findById(req.user.id);
      if (user.resume.public_id) {
        await cloudinary.uploader.destroy(user.resume.public_id);
      }
      const newResume = await cloudinary.uploader.upload(resume.tempFilePath, {
        folder: "PORTFOLIO RESUME",
      });
      newUserData.resume = {
        public_id: newResume.public_id,
        url: newResume.secure_url,
      };
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, newUserData, {
      new: true,
      runValidators: true,
      useFindAndModify: false,
    });

    res
      .status(200)
      .json({ success: true, message: "Profile Updated!", user: updatedUser });
  } catch (error) {
    return next(
      new ErrorHandler(error.message || "Internal Server Error", 500)
    );
  }
});

export const updatePassword = catchAsyncErrors(async (req, res, next) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;
  try {
    const user = await User.findById(req.user.id).select("+password");
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return next(new ErrorHandler("Please Fill All Fields.", 400));
    }
    const isPasswordMatched = await user.comparePassword(currentPassword);
    if (!isPasswordMatched) {
      return next(new ErrorHandler("Incorrect Current Password!"));
    }
    if (newPassword !== confirmNewPassword) {
      return next(
        new ErrorHandler("New Password And Confirm New Password Do Not Match!")
      );
    }
    user.password = newPassword;
    await user.save();
    res.status(200).json({ success: true, message: "Password Updated!" });
  } catch (error) {
    return next(
      new ErrorHandler(error.message || "Internal Server Error", 500)
    );
  }
});

export const getUserForPortfolio = catchAsyncErrors(async (req, res, next) => {
  try {
    const id = "663296a896e553748ab5b0be"; // Assuming this is a specific user ID
    const user = await User.findById(id);
    res.status(200).json({ success: true, user });
  } catch (error) {
    return next(
      new ErrorHandler(error.message || "Internal Server Error", 500)
    );
  }
});

// FORGOT PASSWORD
export const forgotPassword = catchAsyncErrors(async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return next(new ErrorHandler("User Not Found!", 404));
    }
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    const resetPasswordUrl = `${process.env.DASHBOARD_URL}/password/reset/${resetToken}`;

    const message = `Your Reset Password Token is:- \n\n ${resetPasswordUrl}  \n\n If 
    You've not requested this email then, please ignore it.`;

    await sendEmail({
      email: user.email,
      subject: `Personal Portfolio Dashboard Password Recovery`,
      message,
    });

    res.status(201).json({
      success: true,
      message: `Email sent to ${user.email} successfully`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new ErrorHandler(error.message || "Internal Server Error", 500)
    );
  }
});

// RESET PASSWORD
export const resetPassword = catchAsyncErrors(async (req, res, next) => {
  const { token } = req.params;
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  try {
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return next(
        new ErrorHandler(
          "Reset password token is invalid or has been expired.",
          400
        )
      );
    }

    if (req.body.password !== req.body.confirmPassword) {
      return next(new ErrorHandler("Password & Confirm Password do not match"));
    }

    user.password = await req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    generateToken(user, "Reset Password Successfully!", 200, res);
  } catch (error) {
    return next(
      new ErrorHandler(error.message || "Internal Server Error", 500)
    );
  }
});
