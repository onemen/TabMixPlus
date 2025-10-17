import type {AppConstants} from "./gecko/tools/subs/AppConstants.sys.d.mts";

declare global {
  type AppConstantsType = typeof AppConstants;
  type Platform = "linux" | "win" | "macosx" | "ios" | "android" | "other";
}

export {};
