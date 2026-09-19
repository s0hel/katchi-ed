import { PICTURE_CREDIT } from "@/lib/generators/pictures";

/**
 * Credit for the picture artwork.
 *
 * Twemoji is CC BY 4.0, which grants the right to use the icons -- including
 * commercially -- on the condition that they are attributed wherever they
 * appear. So this renders next to the questions that draw them, not once in a
 * licences page nobody opens.
 */
export function PictureCredit({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[0.7rem] text-[var(--kx-muted)] ${className}`}>
      {PICTURE_CREDIT.text}{" "}
      <a
        className="underline underline-offset-2"
        href={PICTURE_CREDIT.href}
        target="_blank"
        rel="noopener noreferrer"
      >
        Source
      </a>
    </p>
  );
}
