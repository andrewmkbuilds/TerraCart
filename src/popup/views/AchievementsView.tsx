import { Award, Flame, Trophy } from 'lucide-react'
import type { PopupData } from '../../hooks/usePopupData'
import ViewHeader from '../components/ViewHeader'
import { ACHIEVEMENTS, LEVELS } from '../../services/points-service'
import { timeAgo } from '../../utils/format'

interface Props {
  data: PopupData
  onBack: () => void
}

export default function AchievementsView({ data, onBack }: Props) {
  const { points, level } = data

  return (
    <div>
      <ViewHeader title="TerraPoints" subtitle={`Level ${level.level} · ${level.name}`} onBack={onBack} />

      <div className="space-y-3 px-4 pb-5">
        <section className="card p-3.5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[22px] font-semibold leading-none tracking-tight">{points.points}</p>
              <p className="mt-1 text-[10px] text-muted">
                {level.next ? `${level.next - points.points} points to next level` : 'Top level reached'}
              </p>
            </div>
            <span className="chip bg-forest-tint text-forest-soft">
              <Flame className="h-2.5 w-2.5" /> {points.streak.current} day streak
            </span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-sand">
            <div className="h-full rounded-full bg-forest-soft" style={{ width: `${level.progress}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[9px] text-muted">
            {LEVELS.slice(0, 6).map((entry, index) => (
              <span key={entry.name} className={index + 1 <= level.level ? 'font-semibold text-forest-soft' : ''}>
                {entry.name}
              </span>
            ))}
          </div>
        </section>

        <section className="card p-3.5">
          <p className="eyebrow mb-2">This week's challenges</p>
          <ul className="space-y-2.5">
            {points.challengeWeek.items.map((challenge) => (
              <li key={challenge.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-medium">{challenge.label}</span>
                  <span className={`text-[10px] font-semibold ${challenge.claimed ? 'text-forest-soft' : 'text-muted'}`}>
                    {challenge.claimed ? 'Done' : `${challenge.progress}/${challenge.target}`}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand">
                  <div
                    className="h-full rounded-full bg-forest-soft"
                    style={{ width: `${Math.min(100, (challenge.progress / challenge.target) * 100)}%` }}
                  />
                </div>
                <p className="mt-0.5 text-[9px] text-muted">+{challenge.reward} TerraPoints</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <p className="eyebrow mb-1.5">Achievements</p>
          <div className="grid grid-cols-2 gap-2">
            {ACHIEVEMENTS.map((achievement) => {
              const unlocked = !!points.achievements[achievement.id]
              return (
                <div
                  key={achievement.id}
                  className={`card p-2.5 ${unlocked ? '' : 'opacity-55'} ${
                    unlocked ? 'border-forest-soft/40' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {unlocked ? (
                      <Award className="h-3.5 w-3.5 text-forest-soft" />
                    ) : (
                      <Trophy className="h-3.5 w-3.5 text-muted" />
                    )}
                    <p className="text-[10.5px] font-semibold leading-tight">{achievement.title}</p>
                  </div>
                  <p className="mt-1 text-[9.5px] leading-snug text-muted">{achievement.description}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section>
          <p className="eyebrow mb-1.5">Points history</p>
          {points.events.length === 0 ? (
            <p className="card p-3 text-[10.5px] leading-relaxed text-muted">
              Analyse a product or tick off a checklist item to start earning.
            </p>
          ) : (
            <ul className="card divide-y divide-line">
              {points.events.slice(0, 12).map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[10.5px] font-medium">{event.label}</p>
                    <p className="text-[9px] text-muted">{timeAgo(event.timestamp)}</p>
                  </div>
                  {event.points > 0 && <span className="chip bg-forest-tint text-forest-soft">+{event.points}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}