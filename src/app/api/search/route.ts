import { NextResponse } from "next/server";
import { searchStargazingAccommodations } from "@/lib/server/accommodation_search_service";

interface SearchBounds {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

interface SearchFilters {
  maxPrice?: number;
  minRating?: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? undefined;
    const prefecture = searchParams.get("prefecture") ?? undefined;
    const bounds = parseJsonParam("bounds", searchParams.get("bounds"));
    const filters = parseJsonParam("filters", searchParams.get("filters"));

    if (!date) {
      return NextResponse.json(
        { message: "date is required" },
        { status: 400 },
      );
    }

    if (prefecture && bounds) {
      return NextResponse.json(
        { message: "prefecture and bounds are mutually exclusive" },
        { status: 400 },
      );
    }

    if (!prefecture && !bounds) {
      return NextResponse.json(
        { message: "prefecture or bounds is required" },
        { status: 400 },
      );
    }

    const validatedBounds = validateBounds(bounds);
    const validatedFilters = validateFilters(filters);

    const result = await searchStargazingAccommodations({
      date,
      prefecture,
      bounds: validatedBounds,
      filters: validatedFilters,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof TypeError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof Error) {
      const status = error.message.startsWith("Unsupported prefecture")
        ? 400
        : 500;
      if (status === 500) {
        console.error("[GET /api/search] Internal error:", error);
      }
      const message = status === 400 ? error.message : "Internal server error";
      return NextResponse.json({ message }, { status });
    }
    console.error("[GET /api/search] Unknown error:", error);
    return NextResponse.json(
      { message: "Unknown error occurred" },
      { status: 500 },
    );
  }
}

function validateBounds(bounds: unknown): SearchBounds | undefined {
  if (typeof bounds === "undefined") {
    return undefined;
  }

  if (!bounds || typeof bounds !== "object") {
    throw new TypeError("bounds must be an object");
  }

  const candidate = bounds as Partial<SearchBounds>;
  const minLatitude = validateFiniteNumber(
    candidate.minLatitude,
    "bounds.minLatitude",
  );
  const maxLatitude = validateFiniteNumber(
    candidate.maxLatitude,
    "bounds.maxLatitude",
  );
  const minLongitude = validateFiniteNumber(
    candidate.minLongitude,
    "bounds.minLongitude",
  );
  const maxLongitude = validateFiniteNumber(
    candidate.maxLongitude,
    "bounds.maxLongitude",
  );

  if (minLatitude >= maxLatitude) {
    throw new TypeError(
      "bounds.minLatitude must be less than bounds.maxLatitude",
    );
  }

  if (minLongitude >= maxLongitude) {
    throw new TypeError(
      "bounds.minLongitude must be less than bounds.maxLongitude",
    );
  }

  if (minLatitude < -90 || maxLatitude > 90) {
    throw new TypeError("latitude must be between -90 and 90");
  }

  if (minLongitude < -180 || maxLongitude > 180) {
    throw new TypeError("longitude must be between -180 and 180");
  }

  return {
    minLatitude,
    maxLatitude,
    minLongitude,
    maxLongitude,
  };
}

function validateFilters(filters: unknown): SearchFilters | undefined {
  if (typeof filters === "undefined") {
    return undefined;
  }

  if (!filters || typeof filters !== "object") {
    throw new TypeError("filters must be an object");
  }

  const candidate = filters as Partial<SearchFilters>;
  const maxPrice =
    typeof candidate.maxPrice === "undefined"
      ? undefined
      : validateFiniteNumber(candidate.maxPrice, "filters.maxPrice");
  const minRating =
    typeof candidate.minRating === "undefined"
      ? undefined
      : validateFiniteNumber(candidate.minRating, "filters.minRating");

  if (typeof maxPrice === "number" && maxPrice < 0) {
    throw new TypeError("filters.maxPrice must be greater than or equal to 0");
  }

  if (typeof minRating === "number" && (minRating < 0 || minRating > 5)) {
    throw new TypeError("filters.minRating must be between 0 and 5");
  }

  return {
    maxPrice,
    minRating,
  };
}

function validateFiniteNumber(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    Number.isNaN(value) ||
    !Number.isFinite(value)
  ) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}

function parseJsonParam(name: string, value: string | null): unknown {
  if (value === null) {
    return undefined;
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new TypeError(`${name} must be valid JSON`);
  }
}
