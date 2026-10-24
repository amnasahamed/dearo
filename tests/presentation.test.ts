import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  prepareHandoff,
  type AppState,
  type Event,
} from "../src/domain";
import { resumeScreen, safeMessage } from "../src/ui/presentation";

const event: Event = {
  id: "event",
  title: "Celebration",
  countryCode: "US",
  invitationUrl: "https://example.com/invitation",
  messageTemplate: "Dear {guest}, join {event}. {link}",
};
function withGuest(): AppState {
  return {
    ...createInitialState(event),
    guests: [
      {
        id: "guest",
        name: "Alex",
        phone: "+14155552671",
        selected: true,
        status: "pending",
      },
    ],
  };
}

test("new event resumes invitation editing", () => {
  assert.equal(resumeScreen(createInitialState(event)), "invitation");
});
test("valid guest queue resumes sending", () => {
  assert.equal(resumeScreen(withGuest()), "send");
});
test("incomplete restored events resume editing, never a throwing preview", () => {
  for (const changes of [{ invitationUrl: "" }, { messageTemplate: "" }]) {
    const state = withGuest();
    state.event = { ...state.event, ...changes };
    assert.equal(safeMessage(state.event, "Alex"), null);
    assert.equal(resumeScreen(state), "invitation");
  }
});
test("invalid preview URL returns null rather than escaping the render", () => {
  assert.equal(
    safeMessage({ ...event, invitationUrl: "javascript:alert(1)" }, "Alex"),
    null,
  );
});
test("safe preview preserves personalized text and invitation link", () => {
  assert.equal(
    safeMessage(event, "Alex"),
    "Dear Alex, join Celebration. https://example.com/invitation",
  );
});
test("pending handoff snapshot takes precedence over incomplete current event", () => {
  const state = prepareHandoff(
    withGuest(),
    "guest",
    "attempt",
    "2026-10-24T10:00:00Z",
  );
  state.event = { ...state.event, invitationUrl: "", messageTemplate: "" };
  assert.equal(resumeScreen(state), "send");
  assert.equal(
    state.pendingHandoff?.preparedMessage,
    "Dear Alex, join Celebration. https://example.com/invitation",
  );
});
