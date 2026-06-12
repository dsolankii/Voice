import multer from "multer";
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  deleteContactListController,
  getContactListController,
  listContactListsController,
  uploadContactListController,
} from "./contact-list.controller.js";

export const contactListRoutes = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

contactListRoutes.use(requireAuth);

contactListRoutes.post(
  "/upload",
  upload.single("file"),
  asyncHandler(uploadContactListController)
);
contactListRoutes.get("/", asyncHandler(listContactListsController));
contactListRoutes.get("/:id", asyncHandler(getContactListController));
contactListRoutes.delete("/:id", asyncHandler(deleteContactListController));
