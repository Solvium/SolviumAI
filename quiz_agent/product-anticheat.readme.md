Proposed Anti-Cheat Features

1. Ephemeral Questions & Answers

Description: Once a user submits an answer to a question, the bot will edit the original message, removing the question text and the answer buttons.
Mechanism: The callback_query_handler will use context.bot.edit_message_text to replace the question with a neutral confirmation message like, "Answer recorded. Please wait for the next question."
Rationale: This prevents a user from sharing a screenshot of the question with others after they have already answered it.


2 Suppressed In-Quiz Feedback

Description: The bot will not provide immediate feedback on whether an answer was correct or incorrect. It will simply acknowledge the submission and proceed.
Mechanism: The answer processing logic in quiz_service.py will record the answer and update the score internally, but the handler in handlers.py will no longer send "Correct!" or "Wrong Answer!" messages.
Rationale: This is a critical measure. If players do not know the correct answers during the quiz, they cannot share them with other participants.


3. Per-Question and Per-Answer Randomisation
Description: The system will shuffle the order of both the questions and the answer options for each participant.
Mechanism:
Question Shuffling: When a user starts a quiz, the list of question IDs is fetched from the database and shuffled in memory before being presented sequentially.
Answer Shuffling: When generating the inline keyboard for a question, the order of the answer options is randomised.
Rationale: This makes it impossible for players to collaborate by sharing information like, "The answer to question 3 is B." For one user, question 3 might be different, and their "B" option will likely be in a different position.

4 . Strict, Per-Question Timers
Description: Each question will have its own short, non-pausable timer (e.g., 15-30 seconds). If the user fails to answer within this window, the question is marked as incorrect, and the bot automatically moves to the next one.
Mechanism: This can be implemented using a scheduler (like apscheduler which is already a dependency of python-telegram-bot) or asyncio.sleep. When a question is sent, a timed job is scheduled to check if an answer has been received.
Rationale: This significantly limits the time available for a user to search for answers online or consult with others.


5. Personalised Post-Quiz Reports
Description: After the quiz officially ends, each participant will receive a private, detailed report. This report will include their final score, their rank, any winnings, and a list of all questions with the correct answers revealed.
Mechanism: A function will trigger at the quiz's conclusion, iterating through all participants to generate and send these personalised messages.
Rationale: This provides transparency and a good user experience by allowing players to learn from their mistakes, but only after the competitive phase is over, thus protecting the integrity of the quiz.
