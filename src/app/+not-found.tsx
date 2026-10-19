import React from "react";
import { Redirect } from "expo-router";

/** Any unknown deep link lands on the entry route, which routes by session. */
export default function NotFound() {
  return <Redirect href="/" />;
}
