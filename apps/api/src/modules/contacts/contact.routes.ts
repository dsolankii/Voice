import multer from "multer";
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createContactController,
  deleteContactController,
  getContactController,
  listContactsController,
  uploadContactsController,
} from "./contact.controller.js";

export const contactRoutes = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

contactRoutes.use(requireAuth);

contactRoutes.post("/", asyncHandler(createContactController));
contactRoutes.post("/upload", upload.single("file"), asyncHandler(uploadContactsController));
contactRoutes.get("/", asyncHandler(listContactsController));
contactRoutes.get("/:id", asyncHandler(getContactController));
contactRoutes.delete("/:id", asyncHandler(deleteContactController));
