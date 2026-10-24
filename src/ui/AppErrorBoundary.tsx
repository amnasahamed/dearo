import React from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, s } from "./components";
export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <SafeAreaView style={s.safe}>
          <View
            style={{ flex: 1, justifyContent: "center", padding: 24, gap: 20 }}
          >
            <Text accessibilityRole="header" style={s.h1}>
              Let’s try that again.
            </Text>
            <Text style={s.body}>
              Dearo could not display this screen. Your saved event has not been
              cleared. Reopen it below, or restart the app if the problem
              continues.
            </Text>
            <Button
              title="Reopen Dearo"
              onPress={() => this.setState({ failed: false })}
            />
          </View>
        </SafeAreaView>
      );
    return this.props.children;
  }
}
