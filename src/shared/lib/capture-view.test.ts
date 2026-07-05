import { describe, expect, it } from "vitest";
import { hasVideoMedia, isTweetCapture, isVideoCapture, tweetGroup } from "./capture-view";

describe("capture routing predicates (D37)", () => {
  it("routes YouTube and video-tweets to Videos, plain tweets to Tweets", () => {
    const youtube = { resource_kind: "video" as const };
    const videoTweet = {
      resource_kind: "tweet" as const,
      media: [{ url: "media/p.jpg", kind: "poster" as const }],
    };
    const plainTweet = {
      resource_kind: "tweet" as const,
      media: [{ url: "media/i.jpg", kind: "image" as const }],
    };

    expect(isVideoCapture(youtube)).toBe(true);
    expect(isVideoCapture(videoTweet)).toBe(true);
    expect(isVideoCapture(plainTweet)).toBe(false);

    expect(isTweetCapture(plainTweet)).toBe(true);
    expect(isTweetCapture(videoTweet)).toBe(false); // moved to Videos
    expect(isTweetCapture(youtube)).toBe(false);

    expect(hasVideoMedia(videoTweet)).toBe(true);
    expect(hasVideoMedia(plainTweet)).toBe(false);
  });

  it("groups tweets into threads / replies / tweets", () => {
    expect(tweetGroup({ resource_kind: "tweet", tweet_subtype: "thread" })).toBe("threads");
    expect(tweetGroup({ resource_kind: "tweet", thread_items: [{ text_markdown: "x" }] })).toBe(
      "threads",
    );
    expect(tweetGroup({ resource_kind: "tweet", tweet_subtype: "reply" })).toBe("replies");
    expect(tweetGroup({ resource_kind: "tweet", reply_to: { handle: "@x" } })).toBe("replies");
    expect(tweetGroup({ resource_kind: "tweet", tweet_subtype: "tweet" })).toBe("tweets");
    expect(tweetGroup({ resource_kind: "tweet", tweet_subtype: "quote" })).toBe("tweets");
  });
});
