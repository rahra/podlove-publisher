<?php 
namespace Podlove\Modules\Notifications;

use Podlove\Modules\Contributors\Model\EpisodeContribution;
use Podlove\Model\Episode;
use Podlove\Modules\Contributors\Model\Contributor;
use Podlove\Log;
use Podlove\Jobs\CronJobRunner;

class Notifications extends \Podlove\Modules\Base {
	
	protected $module_name = 'E-Mail Notifications';
	protected $module_description = 'Notify contributors via E-Mail when episodes get published.';
	protected $module_group = 'system';

	public function load()
	{
		add_action('publish_podcast', [$this, 'maybe_send_notifications'], 10, 2);

		add_filter('podlove_contributor_settings_tabs', function ($tabs) {
			$tabs->addTab( new \Podlove\Modules\Notifications\SettingsTab( __( 'E-Mail Notifications', 'podlove-podcasting-plugin-for-wordpress' ) ) );
			return $tabs;
		});

		add_action('podlove_notifications_start_mailer', [$this, 'start_mailer']);

		if (isset($_REQUEST['podlove_notifications']) && isset($_REQUEST['podlove_notifications']['test_episode'])) {
			$this->send_test_notifications();
		}
	}

	public function send_test_notifications()
	{
		$episode_id = (int) $_REQUEST['podlove_notifications']['test_episode'];
		$receiver = trim($_REQUEST['podlove_notifications']['test_receiver']);

		if (!$episode_id || !$receiver)
			return;

		$episode = Episode::find_by_id($episode_id);

		if (!$episode)
			return;

		$contributors = $this->get_contributors_to_be_notified($episode);

		// stop if there is no one to be notified
		if (!count($contributors))
			return;

		$contributor_ids = array_map(function($c) { return $c->id; }, $contributors);

		$args = [
			'contributors'   => $contributor_ids,
			'episode'        => $episode->id,
			'debug'          => true,
			'debug_receiver' => $receiver
		];

		CronJobRunner::create_job('\Podlove\Modules\Notifications\MailerJob', $args);
	}

	public function maybe_send_notifications($post_id, $post)
	{
		if ($this->notifications_sent($post_id))
			return;

		$this->mark_notifications_sent($post_id);

		$episode = Episode::find_one_by_property('post_id', (int) $post_id);

		$contributors = $this->get_contributors_to_be_notified($episode);

		// stop if there is no one to be notified
		if (!count($contributors))
			return;

		$contributor_ids = array_map(function($c) { return $c->id; }, $contributors);

		$delay = (int) \Podlove\get_setting('notifications', 'delay');
		$delay = $delay * MINUTE_IN_SECONDS;

		$job_args = [
			'contributors' => $contributor_ids,
			'episode' => $episode->id
		];

		wp_schedule_single_event(time() + $delay, 'podlove_notifications_start_mailer', [$job_args]);
	}

	public function start_mailer($args)
	{
		CronJobRunner::create_job('\Podlove\Modules\Notifications\MailerJob', $args);
	}

	private function get_contributors_to_be_notified(Episode $episode)
	{
		$contributions = EpisodeContribution::find_all_by_episode_id($episode->id);

		// map contributions to contributors
		$contributors = array_map(function($c) {
			return Contributor::find_by_id($c->contributor_id);
		}, $contributions);

		return $contributors;
	}

	/**
	 * Were notifications for this episode sent already?
	 * 
	 * @param  int $post_id
	 * @return bool    True if notifications were sent, otherwise false.
	 */
	public function notifications_sent($post_id)
	{
		return (bool) get_post_meta($post_id, '_podlove_notifications_sent', true);
	}

	/**
	 * Remember that notifications have been sent.
	 * 
	 * @param  int $post_id
	 */
	public function mark_notifications_sent($post_id)
	{
		update_post_meta($post_id, '_podlove_notifications_sent', true);
	}

}
