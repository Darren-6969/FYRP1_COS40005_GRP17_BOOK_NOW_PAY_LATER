import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import {
  getCarAvailability,
} from "../../services/listing_public_service";

import {
  klToday,
} from "../../utils/formatPublic";

import styles from
  "../../assets/styles/public/AvailabilityCalendar.module.css";

const WEEKDAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

function toPlainDate(date) {
  return date
    .toISOString()
    .slice(0, 10);
}

function monthStart(plainDate) {
  const date =
    new Date(
      `${plainDate}T12:00:00Z`
    );

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      1
    )
  );
}

function addMonths(date, amount) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + amount,
      1
    )
  );
}

function monthLabel(date) {
  return new Intl.DateTimeFormat(
    "en-MY",
    {
      month: "long",
      year: "numeric",
    }
  ).format(date);
}

function buildMonthDays(month) {
  const year =
    month.getUTCFullYear();

  const monthIndex =
    month.getUTCMonth();

  const firstDay =
    new Date(
      Date.UTC(
        year,
        monthIndex,
        1
      )
    );

  const lastDay =
    new Date(
      Date.UTC(
        year,
        monthIndex + 1,
        0
      )
    );

  const cells = [];

  for (
    let i = 0;
    i < firstDay.getUTCDay();
    i += 1
  ) {
    cells.push(null);
  }

  for (
    let day = 1;
    day <= lastDay.getUTCDate();
    day += 1
  ) {
    cells.push(
      new Date(
        Date.UTC(
          year,
          monthIndex,
          day
        )
      )
    );
  }

  return cells;
}

export default function AvailabilityCalendar({
  listingId,
  selectedFrom,
  selectedTo,
  onSelectDate,
}) {
  const today =
    klToday();

  const initialDate =
    selectedFrom ||
    today;

  const [
    visibleMonth,
    setVisibleMonth,
  ] = useState(
    () =>
      monthStart(
        initialDate
      )
  );

  const [
    availability,
    setAvailability,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const monthFrom =
    toPlainDate(
      visibleMonth
    );

  const monthTo =
    toPlainDate(
      addMonths(
        visibleMonth,
        1
      )
    );

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const response =
          await getCarAvailability(
            listingId,
            monthFrom,
            monthTo
          );

        if (!alive) {
          return;
        }

        setAvailability(
          response.data?.days ||
            []
        );
      } catch (err) {
        if (!alive) {
          return;
        }

        setAvailability([]);

        setError(
          err.response?.data
            ?.message ||
            "Unable to load availability."
        );
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [
    listingId,
    monthFrom,
    monthTo,
  ]);

  const availabilityMap =
    useMemo(
      () =>
        new Map(
          availability.map(
            (day) => [
              day.date,
              day,
            ]
          )
        ),
      [availability]
    );

  const cells =
    useMemo(
      () =>
        buildMonthDays(
          visibleMonth
        ),
      [visibleMonth]
    );

  const currentMonth =
    monthStart(today);

  const canGoPrevious =
    visibleMonth >
    currentMonth;

  const handleDateClick =
    (plainDate, dayInfo) => {
      if (
        plainDate < today ||
        dayInfo?.status ===
          "BLOCKED"
      ) {
        return;
      }

      onSelectDate(
        plainDate
      );
    };

  return (
    <section
      className={
        styles.calendar
      }
      aria-label="Car availability calendar"
    >
      <div
        className={
          styles.header
        }
      >
        <div>
          <p
            className={
              styles.eyebrow
            }
          >
            Availability
          </p>

          <h3
            className={
              styles.title
            }
          >
            {monthLabel(
              visibleMonth
            )}
          </h3>
        </div>

        <div
          className={
            styles.navigation
          }
        >
          <button
            type="button"
            className={
              styles.navButton
            }
            disabled={
              !canGoPrevious
            }
            aria-label="Previous month"
            onClick={() =>
              setVisibleMonth(
                (current) =>
                  addMonths(
                    current,
                    -1
                  )
              )
            }
          >
            <ChevronLeft
              size={18}
            />
          </button>

          <button
            type="button"
            className={
              styles.navButton
            }
            aria-label="Next month"
            onClick={() =>
              setVisibleMonth(
                (current) =>
                  addMonths(
                    current,
                    1
                  )
              )
            }
          >
            <ChevronRight
              size={18}
            />
          </button>
        </div>
      </div>

      <div
        className={
          styles.legend
        }
      >
        <span>
          <i
            className={
              styles.availableDot
            }
          />
          Available
        </span>

        <span>
          <i
            className={
              styles.blockedDot
            }
          />
          Blocked
        </span>
      </div>

      {loading && (
        <p
          className={
            styles.message
          }
        >
          Loading availability...
        </p>
      )}

      {error && (
        <p
          className={
            styles.error
          }
        >
          {error}
        </p>
      )}

      <div
        className={
          styles.weekdays
        }
      >
        {WEEKDAYS.map(
          (day) => (
            <span key={day}>
              {day}
            </span>
          )
        )}
      </div>

      <div
        className={
          styles.grid
        }
      >
        {cells.map(
          (date, index) => {
            if (!date) {
              return (
                <div
                  key={`empty-${index}`}
                  className={
                    styles.empty
                  }
                />
              );
            }

            const plainDate =
              toPlainDate(
                date
              );

            const dayInfo =
              availabilityMap.get(
                plainDate
              );

            const blocked =
              dayInfo?.status ===
              "BLOCKED";

            const past =
              plainDate <
              today;

            const selected =
              plainDate ===
                selectedFrom ||
              plainDate ===
                selectedTo;

            const available =
              !blocked &&
              !past;

            return (
              <button
                key={plainDate}
                type="button"
                disabled={
                  blocked ||
                  past ||
                  !dayInfo
                }
                className={[
                  styles.day,
                  blocked
                    ? styles.blocked
                    : "",
                  available
                    ? styles.available
                    : "",
                  selected
                    ? styles.selected
                    : "",
                  past
                    ? styles.past
                    : "",
                ]
                  .filter(
                    Boolean
                  )
                  .join(" ")}
                onClick={() =>
                  handleDateClick(
                    plainDate,
                    dayInfo
                  )
                }
              >
                <span
                  className={
                    styles.dayNumber
                  }
                >
                  {date.getUTCDate()}
                </span>

                {dayInfo && (
                  <span
                    className={
                      styles.stock
                    }
                  >
                    {blocked
                      ? "Blocked"
                      : `${dayInfo.remaining} ${
                          dayInfo.remaining ===
                          1
                            ? "car"
                            : "cars"
                        }`}
                  </span>
                )}
              </button>
            );
          }
        )}
      </div>

      <p
        className={
          styles.help
        }
      >
        Select an available
        date. Blocked dates
        have no cars remaining.
      </p>
    </section>
  );
}