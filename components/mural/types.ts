export type MuralElementType = "STICKY_NOTE" | "TEXT" | "FRAME" | "IMAGE" | "DRAWING";

export type MuralElementData = {
  id: string;
  type: MuralElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string | null;
  zIndex: number;
  content: Record<string, unknown>;
  createdById: string | null;
};

export const STICKY_COLORS = ["#FEF08A", "#BBF7D0", "#BFDBFE", "#FBCFE8", "#FED7AA", "#E9D5FF"];
