import { Alert, type AlertButton } from "react-native";

/** The one place screens call for a native alert, so copy and buttons stay consistent. */
export function showAlert(
  title: string,
  message: string,
  buttons: AlertButton[] = [{ text: "OK" }],
) {
  Alert.alert(title, message, buttons, { cancelable: true });
}
